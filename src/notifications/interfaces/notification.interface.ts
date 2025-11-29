import { NotificationType } from '../enums/notification.enum';

export interface NotificationActor {
  id: number;
  username: string;
  avatarUrl: string | null;
}

export interface NotificationPayload {
  id: string;
  type: NotificationType;
  recipientId: number;
  actor: NotificationActor;
  isRead: boolean;
  createdAt: string;

  // Post-related fields (optional)
  postId?: number;
  quotePostId?: number;
  replyId?: number;
  threadPostId?: number;
  postPreviewText?: string;

  // DM-related fields (optional)
  conversationId?: number;
  messagePreview?: string;
}

export interface CreateNotificationDto {
  type: NotificationType;
  recipientId: number;
  actorId: number;
  actorUsername: string;
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
