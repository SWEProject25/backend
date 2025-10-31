-- PERFORMANCE INDEXES FOR FEED, RELATIONSHIPS & ENGAGEMENT

-- 1. Feed posts (filter + sort)
CREATE INDEX idx_posts_active_recent 
ON posts (created_at DESC, user_id)
WHERE is_deleted = false;

-- 2. Posts by user
CREATE INDEX idx_posts_user_active 
ON posts (user_id)
WHERE is_deleted = false;

-- 3. Follow relationships
CREATE INDEX idx_follows_follower 
ON follows (followerId, followingId);
CREATE INDEX idx_follows_following 
ON follows (followingId, followerId);

-- 4. Blocks
CREATE INDEX idx_blocks_blocker 
ON blocks (blockerId, blockedId);

-- 5. Likes
CREATE INDEX idx_likes_user 
ON "Like" (user_id, post_id);
CREATE INDEX idx_likes_post 
ON "Like" (post_id, user_id);

-- 6. Replies
CREATE INDEX idx_posts_parent 
ON posts (parent_id)
WHERE parent_id IS NOT NULL AND is_deleted = false;

-- 7. Reposts
CREATE INDEX idx_reposts_post 
ON "Repost" (post_id, user_id);

-- 8. Media
CREATE INDEX idx_media_post 
ON media (post_id);

-- 9. Hashtags
CREATE INDEX idx_post_hashtags_post ON "_PostHashtags" ("B");
CREATE INDEX idx_post_hashtags_tag  ON "_PostHashtags" ("A");

-- 10. Mentions
CREATE INDEX idx_mentions_post 
ON "Mention" (post_id);

-- 11. Profiles
CREATE INDEX idx_profiles_user 
ON profiles (user_id);

-- ANALYZE TABLES
ANALYZE posts;
ANALYZE follows;
ANALYZE "Like";
ANALYZE blocks;
ANALYZE "Repost";
ANALYZE media;
ANALYZE "_PostHashtags";
ANALYZE "Mention";
ANALYZE profiles;
