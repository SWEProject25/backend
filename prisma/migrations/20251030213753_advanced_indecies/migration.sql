/*
  Warnings:

  - You are about to drop the `Media` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropIndex
DROP INDEX IF EXISTS "idx_likes_post";

-- DropIndex
DROP INDEX IF EXISTS "idx_likes_post_user_combined";

-- DropIndex
DROP INDEX IF EXISTS "idx_likes_user";

-- DropIndex
DROP INDEX IF EXISTS "idx_mentions_post";

-- DropIndex
DROP INDEX IF EXISTS "idx_reposts_post";

-- DropIndex
DROP INDEX IF EXISTS "idx_blocks_blocker";

-- DropIndex
DROP INDEX IF EXISTS "idx_follows_follower";

-- DropIndex
DROP INDEX IF EXISTS "idx_follows_following";

-- DropIndex
DROP INDEX IF EXISTS "idx_follows_following_follower_combined";

-- DropIndex
DROP INDEX IF EXISTS "idx_profiles_user";

-- DropTable
DROP TABLE IF EXISTS "Media";

-- CreateTable
CREATE TABLE "media" (
    "id" SERIAL NOT NULL,
    "post_id" INTEGER NOT NULL,
    "media_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "MediaType" NOT NULL,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
