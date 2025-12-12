-- Enable pg_trgm extension for trigram similarity and pattern matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN trigram index on posts content for efficient ILIKE and similarity searches
CREATE INDEX posts_content_trgm_idx ON posts USING GIN (content gin_trgm_ops);
