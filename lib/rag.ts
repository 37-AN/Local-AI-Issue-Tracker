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

function fnv1a32(input: string): number {
  // 32-bit FNV-1a
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // Convert to unsigned 32-bit
  return hash >>> 0;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * Local-only baseline embedding (feature hashing) into 384 dims.
 * Deterministic, fast, no external calls, no model files.
 * Can be swapped later for a real local embedding model without changing DB schema.
 */
export function embedTextToVector384(text: string): number[] {
  const vec = new Array<number>(RAG_EMBEDDING_DIM).fill(0);

  const tokens = tokenize(text);
  for (const tok of tokens) {
    const h = fnv1a32(tok);
    const idx = h % RAG_EMBEDDING_DIM;
    const sign = (h & 1) === 0 ? 1 : -1;
    vec[idx] += sign;
  }

  // L2 normalize
  let sumSq = 0;
  for (let i = 0; i < vec.length; i++) sumSq += vec[i] * vec[i];
  const norm = Math.sqrt(sumSq) || 1;

  for (let i = 0; i < vec.length; i++) vec[i] = vec[i] / norm;

  return vec;
}

export function vectorToPgVectorString(vec: number[]): string {
  if (vec.length !== RAG_EMBEDDING_DIM) {
    throw new Error(
      `Embedding must be ${RAG_EMBEDDING_DIM} dims, got ${vec.length}`
    );
  }
  // pgvector accepts: '[0.1, 0.2, ...]'
  // Keep short-ish strings.
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

  const rows = chunks.map((chunk, i) => {
    const embedding = vectorToPgVectorString(embedTextToVector384(chunk));
    return {
      source_type: input.sourceType,
      source_id: input.sourceId,
      chunk_index: i,
      title: input.title,
      content: chunk,
      metadata: input.metadata ?? {},
      embedding,
    };
  });

  const { error } = await supabase
    .from("rag_items")
    .upsert(rows, { onConflict: "source_type,source_id,chunk_index" });

  if (error) throw new Error(error.message);

  return { chunksUpserted: rows.length };
}

export async function ragSearch(input: RagSearchInput) {
  const supabase = await createClient();

  const embedding = vectorToPgVectorString(embedTextToVector384(input.query));
  const limit = Math.max(1, Math.min(input.limit ?? 8, 50));

  const { data, error } = await supabase.rpc("rag_search", {
    query_embedding: embedding,
    match_count: limit,
    filter_source_type: input.filterSourceType ?? null,
  });

  if (error) throw new Error(error.message);

  return data ?? [];
}
