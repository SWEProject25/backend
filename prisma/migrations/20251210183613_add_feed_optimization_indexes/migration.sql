-- CreateIndex
CREATE INDEX "posts_is_deleted_type_created_at_idx" ON "posts"("is_deleted", "type", "created_at");

-- CreateIndex
CREATE INDEX "posts_interest_id_is_deleted_type_created_at_idx" ON "posts"("interest_id", "is_deleted", "type", "created_at");

-- CreateIndex
CREATE INDEX "posts_user_id_is_deleted_type_created_at_idx" ON "posts"("user_id", "is_deleted", "type", "created_at");

-- CreateIndex
CREATE INDEX "posts_parent_id_is_deleted_idx" ON "posts"("parent_id", "is_deleted");

-- CreateIndex
CREATE INDEX "posts_created_at_idx" ON "posts"("created_at" DESC);

-- CreateIndex
CREATE INDEX "follows_followerId_idx" ON "follows"("followerId");

-- CreateIndex
CREATE INDEX "follows_followingId_idx" ON "follows"("followingId");

-- CreateIndex
CREATE INDEX "blocks_blockerId_idx" ON "blocks"("blockerId");

-- CreateIndex
CREATE INDEX "blocks_blockedId_idx" ON "blocks"("blockedId");

-- CreateIndex
CREATE INDEX "mutes_muterId_idx" ON "mutes"("muterId");

-- CreateIndex
CREATE INDEX "mutes_mutedId_idx" ON "mutes"("mutedId");

-- CreateIndex
CREATE INDEX "Like_user_id_idx" ON "Like"("user_id");

-- CreateIndex
CREATE INDEX "Like_post_id_idx" ON "Like"("post_id");

-- CreateIndex
CREATE INDEX "Repost_user_id_created_at_idx" ON "Repost"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "Repost_created_at_idx" ON "Repost"("created_at");

-- CreateIndex
CREATE INDEX "Mention_post_id_idx" ON "Mention"("post_id");

-- CreateIndex
CREATE INDEX "Mention_user_id_idx" ON "Mention"("user_id");

-- CreateIndex
CREATE INDEX "Media_post_id_idx" ON "Media"("post_id");

-- CreateIndex
CREATE INDEX "user_interests_user_id_idx" ON "user_interests"("user_id");

-- CreateIndex
CREATE INDEX "user_interests_interest_id_idx" ON "user_interests"("interest_id");

-- CreateIndex
CREATE INDEX "interests_is_active_idx" ON "interests"("is_active");