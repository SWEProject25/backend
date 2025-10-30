/*
  Warnings:

  - You are about to drop the `Media` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropIndex
DROP INDEX "dev"."idx_likes_post" IF EXISTS idx_likes_post;

-- DropIndex
DROP INDEX "dev"."idx_likes_post_user_combined" IF EXISTS idx_likes_post_user_combined;

-- DropIndex
DROP INDEX "dev"."idx_likes_user" IF EXISTS idx_likes_user;

-- DropIndex
DROP INDEX "dev"."idx_mentions_post" IF EXISTS idx_mentions_post;

-- DropIndex
DROP INDEX "dev"."idx_reposts_post" IF EXISTS idx_reposts_post;

-- DropIndex
DROP INDEX "dev"."idx_blocks_blocker" IF EXISTS idx_blocks_blocker;

-- DropIndex
DROP INDEX "dev"."idx_follows_follower" IF EXISTS idx_follows_follower;

-- DropIndex
DROP INDEX "dev"."idx_follows_following" IF EXISTS idx_follows_following;

-- DropIndex
DROP INDEX "dev"."idx_follows_following_follower_combined" IF EXISTS idx_follows_following_follower_combined;

-- DropIndex
DROP INDEX "dev"."idx_profiles_user" IF EXISTS idx_profiles_user;

-- DropTable
DROP TABLE "dev"."Media" IF EXISTS idx_likes_post;

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
