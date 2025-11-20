-- Rename table from media to Media
ALTER TABLE IF EXISTS "media" RENAME TO "Media";

-- Rename the primary key constraint
ALTER TABLE "Media" RENAME CONSTRAINT "media_pkey" TO "Media_pkey";

-- Rename the foreign key constraint
ALTER TABLE "Media" RENAME CONSTRAINT "media_post_id_fkey" TO "Media_post_id_fkey";
