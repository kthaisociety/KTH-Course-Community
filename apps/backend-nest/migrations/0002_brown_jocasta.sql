-- LEGACY: kept for historical reference only.
-- Use 0000_baseline_current_schema.sql for active schema bootstrap.
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "embedding_hash" text;