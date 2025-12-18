import { NotificationType } from '../enums/notification.enum';

export interface NotificationActor {
  id: number;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface NotificationPostData {
  userId: number;
  username: string;
  verified: boolean;
  name: string;
  avatar: string | null;
  postId: number;
  parentId: number | null;
  type: string;
  date: Date | string;
  likesCount: number;
  retweetsCount: number;
  commentsCount: number;
  isLikedByMe: boolean;
  isFollowedByMe: boolean;
  isRepostedByMe: boolean;
  isMutedByMe: boolean;
  isBlockedByMe: boolean;
  text: string;
  media: Array<{ url: string; type: string }>;
  mentions: Array<{ id: number; username: string }>;
  isRepost: boolean;
  isQuote: boolean;
  originalPostData?: NotificationPostData;
}

export interface NotificationPayload {
  id: string;
  type: NotificationType;
  recipientId: number;
  actor: NotificationActor;
  isRead: boolean;
  createdAt: string;

  postId?: number;
  quotePostId?: number;
  replyId?: number;
  threadPostId?: number;
  postPreviewText?: string;

  conversationId?: number;
  messagePreview?: string;

  // Full post data for REPLY, QUOTE, MENTION notifications
  post?: NotificationPostData;
}

export interface CreateNotificationDto {
  type: NotificationType;
  recipientId: number;
  actorId: number;
  actorUsername: string;
  actorDisplayName?: string | null;
  actorAvatarUrl?: string | null;

  // Post-related
  postId?: number;
  quotePostId?: number;
  replyId?: number;
  threadPostId?: number;
  postPreviewText?: string;

  // DM-related
  conversationId?: number;
  messagePreview?: string;
}
