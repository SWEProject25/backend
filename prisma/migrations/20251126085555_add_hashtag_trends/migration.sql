-- CreateTable
CREATE TABLE "HashtagTrend" (
    "id" SERIAL NOT NULL,
    "hashtag_id" INTEGER NOT NULL,
    "post_count_1h" INTEGER NOT NULL,
    "post_count_24h" INTEGER NOT NULL,
    "post_count_7d" INTEGER NOT NULL,
    "trending_score" DOUBLE PRECISION NOT NULL,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HashtagTrend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HashtagTrend_trending_score_idx" ON "HashtagTrend"("trending_score");

-- CreateIndex
CREATE INDEX "HashtagTrend_hashtag_id_idx" ON "HashtagTrend"("hashtag_id");

-- AddForeignKey
ALTER TABLE "HashtagTrend" ADD CONSTRAINT "HashtagTrend_hashtag_id_fkey" FOREIGN KEY ("hashtag_id") REFERENCES "Hashtag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
