/*
 Warnings:
 
 - A unique constraint covering the columns `[hashtag_id,category,user_id]` on the table `hashtag_trends` will be added. If there are existing duplicate values, this will fail.
 
 */
-- First, delete duplicate rows that would violate the new constraint
-- Keep only the most recent entry for each (hashtag_id, category, user_id) combination
DELETE FROM
  "hashtag_trends"
WHERE
  id NOT IN (
    SELECT
      MAX(id)
    FROM
      "hashtag_trends"
    GROUP BY
      hashtag_id,
      category,
      COALESCE(user_id, -1)
  );

-- CreateIndex
CREATE INDEX "hashtag_trends_user_id_category_trending_score_idx" ON "hashtag_trends"("user_id", "category", "trending_score");

-- CreateIndex
CREATE UNIQUE INDEX "hashtag_trends_hashtag_id_category_user_id_key" ON "hashtag_trends"("hashtag_id", "category", "user_id");