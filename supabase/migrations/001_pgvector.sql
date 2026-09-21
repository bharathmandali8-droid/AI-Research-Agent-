-- Enable pgvector extension (run once per Supabase project)
CREATE EXTENSION IF NOT EXISTS vector;

-- Research reports table with vector embeddings
CREATE TABLE IF NOT EXISTS research_reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question    text NOT NULL,
  report      text NOT NULL,
  sources     jsonb NOT NULL DEFAULT '[]',
  embedding   vector(768) NOT NULL,   -- text-embedding-004 outputs 768 dimensions
  created_at  timestamptz DEFAULT now()
);

-- IVFFlat index for approximate nearest-neighbour cosine search
CREATE INDEX IF NOT EXISTS research_reports_embedding_idx
  ON research_reports
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- RPC function: returns rows whose cosine similarity exceeds the threshold
-- Called by rag.ts → findSimilar()
CREATE OR REPLACE FUNCTION match_research_reports(
  query_embedding   vector(768),
  match_threshold   float,
  match_count       int
)
RETURNS TABLE (
  id          uuid,
  question    text,
  report      text,
  similarity  float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    id,
    question,
    report,
    1 - (embedding <=> query_embedding) AS similarity
  FROM research_reports
  WHERE 1 - (embedding <=> query_embedding) >= match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

