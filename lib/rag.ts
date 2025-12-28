import { createClient } from "@/lib/supabase/server";

export const RAG_EMBEDDING_DIM = 384 as const;

export type RagUpsertInput = {
  sourceType: string;
  sourceId: string;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
  maxChunkChars?: number;
  overlapChars?: number;
};

export type RagSearchInput = {
  query: string;
  limit?: number;
  filterSourceType?: string | null;
};

export type RagResult = {
  id: string;
  source_type: string;
  source_id: string;
  chunk_index: number;
  title: string;
  content: string;
  metadata: any;
  score: number;
};

export async function embedTextToVector384(text: string): Promise<number[]> {
  const norm = text.toLowerCase().trim();
  const vector = new Array(384).fill(0);

  for (let i = 0; i < norm.length; i++) {
    const charCode = norm.charCodeAt(i);
    const bucket = (charCode * (i + 1)) % 384;
    vector[bucket] += 1;
  }

  const mag = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0)) || 1;
  return vector.map((v) => v / mag);
}

export function vectorToPgVectorString(vec: number[]): string {
  if (vec.length !== RAG_EMBEDDING_DIM) {
    throw new Error(
      `Embedding must be ${RAG_EMBEDDING_DIM} dims, got ${vec.length}`
    );
  }
  const rounded = vec.map((v) => Number(v.toFixed(6)));
  return `[${rounded.join(",")}]`;
}

export function chunkTextByChars(
  text: string,
  maxChars = 1400,
  overlapChars = 200
): string[] {
  const clean = text.trim();
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];

  const chunks: string[] = [];
  let start = 0;

  while (start < clean.length) {
    const end = Math.min(start + maxChars, clean.length);
    const chunk = clean.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= clean.length) break;
    start = Math.max(0, end - overlapChars);
  }

  return chunks;
}

export async function ragUpsert(input: RagUpsertInput): Promise<{
  chunksUpserted: number;
}> {
  const supabase = await createClient();

  const chunks = chunkTextByChars(
    input.content,
    input.maxChunkChars ?? 1400,
    input.overlapChars ?? 200
  );

  if (chunks.length === 0) return { chunksUpserted: 0 };

  const rows = await Promise.all(
    chunks.map(async (chunk, i) => {
      const vec = await embedTextToVector384(chunk);
      const embedding = vectorToPgVectorString(vec);
      return {
        source_type: input.sourceType,
        source_id: input.sourceId,
        chunk_index: i,
        title: input.title,
        content: chunk,
        metadata: input.metadata ?? {},
        embedding,
      };
    })
  );

  const { error } = await (supabase.from("rag_items") as any)
    .upsert(rows, { onConflict: "source_type,source_id,chunk_index" });

  if (error) throw new Error(error.message);

  return { chunksUpserted: rows.length };
}


export async function ragSearch(input: RagSearchInput): Promise<RagResult[]> {
  const supabase = await createClient();

  const vec = await embedTextToVector384(input.query);
  const embedding = vectorToPgVectorString(vec);
  const limit = Math.max(1, Math.min(input.limit ?? 8, 50));

  const { data, error } = await (supabase as any).rpc("rag_search", {
    query_embedding: embedding,
    match_count: limit,
    filter_source_type: input.filterSourceType ?? null,
  });

  if (error) throw new Error(error.message);

  const results = (data as any[]) || [];

  return results.map((row) => ({
    id: row.id,
    source_type: row.source_type,
    source_id: row.source_id,
    chunk_index: row.chunk_index,
    title: row.title,
    content: row.content,
    metadata: row.metadata,
    score: row.similarity,
  }));
}
