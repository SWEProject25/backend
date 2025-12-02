-- Add unique indexes to prevent duplicate notifications

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_like_unique 
ON notifications(recipient_id, actor_id, post_id, type) 
WHERE type = 'LIKE' AND post_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_repost_unique 
ON notifications(recipient_id, actor_id, post_id, type) 
WHERE type = 'REPOST' AND post_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_follow_unique 
ON notifications(recipient_id, actor_id, type) 
WHERE type = 'FOLLOW';

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_mention_unique 
ON notifications(recipient_id, actor_id, post_id, type) 
WHERE type = 'MENTION' AND post_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_quote_unique 
ON notifications(recipient_id, actor_id, quote_post_id, type) 
WHERE type = 'QUOTE' AND quote_post_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_reply_unique 
ON notifications(recipient_id, actor_id, reply_id, type) 
WHERE type = 'REPLY' AND reply_id IS NOT NULL;