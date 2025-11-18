-- CRITICAL INDEXES FOR FOR YOU FEED PERFORMANCE

-- 1. Posts filtering and sorting (MOST IMPORTANT)
CREATE INDEX IF NOT EXISTS idx_posts_active_recent 
ON posts (is_deleted, created_at DESC, user_id) 
WHERE is_deleted = false;

-- 2. Posts by user for author stats
CREATE INDEX IF NOT EXISTS idx_posts_user_active 
ON posts (user_id, is_deleted) 
WHERE is_deleted = false;

-- 3. Follow relationships (bidirectional)
CREATE INDEX IF NOT EXISTS idx_follows_follower 
ON follows ("followerId", "followingId");

CREATE INDEX IF NOT EXISTS idx_follows_following 
ON follows ("followingId", "followerId");

-- 4. Blocks lookup
CREATE INDEX IF NOT EXISTS idx_blocks_blocker 
ON blocks ("blockerId", "blockedId");

-- 5. Likes - for author preference and engagement
CREATE INDEX IF NOT EXISTS idx_likes_user 
ON "Like" (user_id, post_id);

CREATE INDEX IF NOT EXISTS idx_likes_post 
ON "Like" (post_id, user_id);

-- 6. Replies for engagement count
CREATE INDEX IF NOT EXISTS idx_posts_parent 
ON posts (parent_id, is_deleted) 
WHERE parent_id IS NOT NULL AND is_deleted = false;

-- 7. Reposts for engagement
CREATE INDEX IF NOT EXISTS idx_reposts_post 
ON "Repost" (post_id, user_id);

-- 8. Media check
CREATE INDEX IF NOT EXISTS idx_media_post 
ON "Media" (post_id);

-- 9. Hashtags relationship
CREATE INDEX IF NOT EXISTS idx_post_hashtags_post 
ON "_PostHashtags" ("B");

-- 10. Mentions
CREATE INDEX IF NOT EXISTS idx_mentions_post 
ON "Mention" (post_id);

-- 11. Profile lookup for author data
CREATE INDEX IF NOT EXISTS idx_profiles_user 
ON profiles (user_id);

-- COMPOSITE INDEXES FOR COMPLEX QUERIES

-- 12. For "common likes" - people you follow who liked a post
CREATE INDEX IF NOT EXISTS idx_likes_post_user_combined 
ON "Like" (post_id, user_id);

-- 13. For "common follows" - people you follow who follow an author
CREATE INDEX IF NOT EXISTS idx_follows_following_follower_combined 
ON follows ("followingId", "followerId");