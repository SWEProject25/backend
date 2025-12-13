-- DropIndex
DROP INDEX "public"."posts_content_trgm_idx";

-- AlterTable
ALTER TABLE "hashtag_trends" ADD COLUMN     "user_id" INTEGER;

-- AddForeignKey
ALTER TABLE "hashtag_trends" ADD CONSTRAINT "hashtag_trends_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
