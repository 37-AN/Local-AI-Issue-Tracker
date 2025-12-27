BEGIN;

-- Vector extension (pgvector)
CREATE EXTENSION IF NOT EXISTS vector;

-- Unified RAG memory store (tickets, SOPs, postmortems, etc.)
CREATE TABLE IF NOT EXISTS public.rag_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL,
  source_id text NOT NULL,
  chunk_index integer NOT NULL DEFAULT 0,
  title text NOT NULL,
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  embedding vector(384) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS rag_items_source_unique
  ON public.rag_items (source_type, source_id, chunk_index);

-- Vector index for fast similarity search (cosine distance)
CREATE INDEX IF NOT EXISTS rag_items_embedding_ivfflat
  ON public.rag_items USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Simple similarity search function (cosine similarity score in [~0,1])
CREATE OR REPLACE FUNCTION public.rag_search(
  query_embedding vector(384),
  match_count integer DEFAULT 8,
  filter_source_type text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  source_type text,
  source_id text,
  chunk_index integer,
  title text,
  content text,
  metadata jsonb,
  score double precision
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    r.id,
    r.source_type,
    r.source_id,
    r.chunk_index,
    r.title,
    r.content,
    r.metadata,
    (1 - (r.embedding <=> query_embedding))::double precision AS score
  FROM public.rag_items r
  WHERE filter_source_type IS NULL OR r.source_type = filter_source_type
  ORDER BY r.embedding <=> query_embedding
  LIMIT match_count;
$$;

COMMIT;