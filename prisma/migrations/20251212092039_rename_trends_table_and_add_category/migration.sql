/*
  Warnings:

  - You are about to drop the `HashtagTrend` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."HashtagTrend" DROP CONSTRAINT "HashtagTrend_hashtag_id_fkey";

-- DropTable
DROP TABLE "public"."HashtagTrend";

-- CreateTable
CREATE TABLE "hashtag_trends" (
    "id" SERIAL NOT NULL,
    "hashtag_id" INTEGER NOT NULL,
    "category" VARCHAR(50) NOT NULL DEFAULT 'general',
    "post_count_1h" INTEGER NOT NULL,
    "post_count_24h" INTEGER NOT NULL,
    "post_count_7d" INTEGER NOT NULL,
    "trending_score" DOUBLE PRECISION NOT NULL,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hashtag_trends_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hashtag_trends_category_trending_score_idx" ON "hashtag_trends"("category", "trending_score");

-- CreateIndex
CREATE INDEX "hashtag_trends_category_calculated_at_idx" ON "hashtag_trends"("category", "calculated_at");

-- CreateIndex
CREATE UNIQUE INDEX "hashtag_trends_hashtag_id_category_key" ON "hashtag_trends"("hashtag_id", "category");

-- AddForeignKey
ALTER TABLE "hashtag_trends" ADD CONSTRAINT "hashtag_trends_hashtag_id_fkey" FOREIGN KEY ("hashtag_id") REFERENCES "Hashtag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
