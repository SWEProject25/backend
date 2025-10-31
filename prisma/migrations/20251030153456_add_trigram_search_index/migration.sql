-- Enable pg_trgm extension for trigram similarity search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add GIN index on content for fast text search
CREATE INDEX IF NOT EXISTS "posts_content_gin_idx" ON "posts" USING gin(content gin_trgm_ops);
