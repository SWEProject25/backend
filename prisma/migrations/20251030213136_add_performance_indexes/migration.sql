-- PERFORMANCE INDEXES FOR FEED, RELATIONSHIPS & ENGAGEMENT

-- 1. Feed posts (filter + sort)
CREATE INDEX IF NOT EXISTS idx_posts_active_recent 
ON posts (created_at DESC, user_id)
WHERE is_deleted = false;

-- 2. Posts by user
CREATE INDEX IF NOT EXISTS idx_posts_user_active 
ON posts (user_id)
WHERE is_deleted = false;

-- 3. Follow relationships
CREATE INDEX IF NOT EXISTS idx_follows_follower 
ON follows ("followerId", "followingId");
CREATE INDEX IF NOT EXISTS idx_follows_following 
ON follows ("followingId", "followerId");

-- 4. Blocks
CREATE INDEX IF NOT EXISTS idx_blocks_blocker 
ON blocks ("blockerId", "blockedId");

-- 5. Likes
CREATE INDEX IF NOT EXISTS idx_likes_user 
ON "Like" (user_id, post_id);
CREATE INDEX IF NOT EXISTS idx_likes_post 
ON "Like" (post_id, user_id);

-- 6. Replies
CREATE INDEX IF NOT EXISTS idx_posts_parent 
ON posts (parent_id)
WHERE parent_id IS NOT NULL AND is_deleted = false;

-- 7. Reposts
CREATE INDEX IF NOT EXISTS idx_reposts_post 
ON "Repost" (post_id, user_id);

-- 8. Media
CREATE INDEX IF NOT EXISTS idx_media_post 
ON "Media" (post_id);

-- 9. Hashtags
CREATE INDEX IF NOT EXISTS idx_post_hashtags_post ON "_PostHashtags" ("B");
CREATE INDEX IF NOT EXISTS idx_post_hashtags_tag  ON "_PostHashtags" ("A");

-- 10. Mentions
CREATE INDEX IF NOT EXISTS idx_mentions_post 
ON "Mention" (post_id);

-- 11. Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_user 
ON profiles (user_id);

-- ANALYZE TABLES
ANALYZE posts;
ANALYZE follows;
ANALYZE "Like";
ANALYZE blocks;
ANALYZE "Repost";
ANALYZE "Media";
ANALYZE "_PostHashtags";
ANALYZE "Mention";
ANALYZE profiles;
