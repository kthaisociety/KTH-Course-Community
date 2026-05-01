-- LEGACY: kept for historical reference only.
-- Use 0000_baseline_current_schema.sql for active schema bootstrap.
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add embedding column (already exists in DB, this is for fresh environments)
ALTER TABLE courses ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Add generated search_vector column 
ALTER TABLE courses ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple',
      coalesce(name_english, '') || ' ' ||
      coalesce(name_swedish, '') || ' ' ||
      coalesce(code, '') || ' ' ||
      coalesce(goals, '') || ' ' ||
      coalesce(content, '')
    )
  ) STORED;

-- Add embedding hash column for incremental embedding updates
ALTER TABLE courses ADD COLUMN IF NOT EXISTS embedding_hash text;

-- Indexes
CREATE INDEX IF NOT EXISTS courses_embedding_idx
  ON courses USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS courses_search_vector_idx
  ON courses USING GIN (search_vector);

CREATE INDEX IF NOT EXISTS courses_name_trgm_idx
  ON courses USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS courses_code_trgm_idx
  ON courses USING GIN (code gin_trgm_ops);