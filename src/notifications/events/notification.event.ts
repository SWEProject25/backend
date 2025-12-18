import { NotificationType } from '../enums/notification.enum';

export class NotificationEvent {
  recipientId: number;
  type: NotificationType;
  actorId: number;
  postId?: number;
  quotePostId?: number;
  replyId?: number;
  threadPostId?: number;
  conversationId?: number;
  messageText?: string;
}
