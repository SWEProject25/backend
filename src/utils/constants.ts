export enum Routes {
  AUTH = 'auth',
  USER = 'user',
  EMAIL = 'email',
  PROFILE = 'profile',
}

export enum Services {
  AUTH = 'AUTH_SERVICE',
  USER = 'USER_SERVICE',
  PRISMA = 'PRISMA_SERVICE',
  EMAIL = 'EMAIL_SERVICE',
  PASSWORD = 'PASSWORD_SERVICE',
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION_SERVICE',
  JWT_TOKEN = 'JWT_TOKEN_SERVICE',
  OTP = 'OTP_SERVICE',
  POST = 'POST_SERVICE',
  LIKE = 'LIKE_SERVICE',
  REPOST = 'REPOST_SERVICE',
  MENTION = 'MENTION_SERVICE',
  PROFILE = 'PROFILE_SERVICE',
  USERS = 'USERS_SERVICE',
  STORAGE = 'STORAGE_SERVICE',
  CONVERSATIONS = 'CONVERSATIONS_SERVICE',
  MESSAGES = 'MESSAGES_SERVICE',
  REDIS = 'REDIS_SERVICE',
  AI_SUMMARIZATION = 'AI_SUMMARIZATION_SERVICE',
  QUEUE_CONSUMER = 'QUEUE_CONSUMER_SERVICE',
  ML = 'ML_SERVICE',
  HASHTAG_TRENDS = 'HASHTAG_TRENDS_SERVICE',
  HASHTAG_JOB_QUEUE = 'HASHTAG_CALCULATE_PROCESSOR',
  HASHTAG_BULK_JOB_QUEUE = 'HASHTAG_RECALCULATE_PROCESSOR',
}

export enum RequestType {
  WEB = 'WEB',
  MOBILE = 'MOBILE',
}

export const RedisQueues = {
  postQueue: {
    name: 'post-queue',
    processes: {
      summarizePostContent: 'summarize-post-content',
    },
  },
  hashTagQueue: {
    name: 'hashtag-trending',
    processes: {
      calculateTrends: 'calculate-trends',
    },
  },
  bulkHashTagQueue: {
    name: 'recalculate-bulk-trends',
    processes: {
      recalculateTrends: 'recalculate-trends',
    },
  },
};
