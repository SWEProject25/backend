import { Injectable, Logger, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationEvent } from './notification.event';
import { NotificationService } from '../notification.service';
import { NotificationType } from '../enums/notification.enum';
import { PrismaService } from 'src/prisma/prisma.service';
import { Services } from 'src/utils/constants';

@Injectable()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);

  constructor(
    @Inject(Services.NOTIFICATION)
    private readonly notificationService: NotificationService,
    @Inject(Services.PRISMA)
    private readonly prismaService: PrismaService,
  ) {}

  @OnEvent('notification.create')
  async handleNotificationCreate(event: NotificationEvent) {
    try {
      this.logger.debug(`Received notification event: ${event.type} for user ${event.recipientId}`);

      // Fetch actor information
      const actor = await this.prismaService.user.findUnique({
        where: { id: event.actorId },
        select: {
          username: true,
          Profile: {
            select: {
              name: true,
              profile_image_url: true,
            },
          },
        },
      });

      if (!actor) {
        this.logger.error(`Actor not found: ${event.actorId}`);
        return;
      }

      // Build notification data
      let postPreviewText: string | undefined;
      let messagePreview: string | undefined;

      // For post-related notifications, fetch post content
      if (event.postId) {
        const post = await this.prismaService.post.findUnique({
          where: { id: event.postId },
          select: { content: true },
        });

        if (post?.content) {
          postPreviewText = this.notificationService.truncateText(post.content, 100);
        }
      }

      // For DM notifications
      if (event.conversationId && event.messageText) {
        messagePreview = this.notificationService.truncateText(event.messageText, 100);
      }

      // Create notification in database
      const notification = await this.notificationService.createNotification({
        type: event.type,
        recipientId: event.recipientId,
        actorId: event.actorId,
        actorUsername: actor.username,
        actorDisplayName: actor.Profile?.name || null,
        actorAvatarUrl: actor.Profile?.profile_image_url || null,
        postId: event.postId,
        quotePostId: event.quotePostId,
        replyId: event.replyId,
        threadPostId: event.threadPostId,
        postPreviewText,
        conversationId: event.conversationId,
        messagePreview,
      });

      // If notification creation returned null, it means it was a duplicate
      if (!notification) {
        this.logger.debug(
          `Duplicate notification skipped: ${event.type} for user ${event.recipientId}`,
        );
        return;
      }

      // Send push notification
      const { title, body } = this.buildPushNotificationMessage(
        event.type,
        actor.Profile?.name || actor.username,
        postPreviewText,
        messagePreview,
      );

      // Send same data structure as Firestore for consistency
      await this.notificationService.sendPushNotification(event.recipientId, title, body, {
        id: notification.id,
        type: notification.type,
        recipientId: notification.recipientId.toString(),
        actorId: notification.actor.id.toString(),
        actorUsername: notification.actor.username,
        actorDisplayName: notification.actor.displayName || '',
        actorAvatarUrl: notification.actor.avatarUrl || '',
        postId: notification.postId?.toString() || '',
        quotePostId: notification.quotePostId?.toString() || '',
        replyId: notification.replyId?.toString() || '',
        threadPostId: notification.threadPostId?.toString() || '',
        postPreviewText: notification.postPreviewText || '',
        conversationId: notification.conversationId?.toString() || '',
        messagePreview: notification.messagePreview || '',
        isRead: notification.isRead.toString(),
        createdAt: notification.createdAt,
      });

      this.logger.log(`Notification processed: ${event.type} for user ${event.recipientId}`);
    } catch (error) {
      this.logger.error('Failed to process notification event', error);
    }
  }

  /**
   * Build push notification title and body based on notification type
   */
  private buildPushNotificationMessage(
    type: NotificationType,
    actorDisplayName: string,
    postPreview?: string,
    messagePreview?: string,
  ): { title: string; body: string } {
    switch (type) {
      case NotificationType.LIKE:
        return {
          title: 'New Like',
          body: `${actorDisplayName} liked your post${postPreview ? `: "${postPreview}"` : ''}`,
        };

      case NotificationType.REPOST:
        return {
          title: 'New Repost',
          body: `${actorDisplayName} reposted your post${postPreview ? `: "${postPreview}"` : ''}`,
        };

      case NotificationType.QUOTE:
        return {
          title: 'New Quote',
          body: `${actorDisplayName} quoted your post${postPreview ? `: "${postPreview}"` : ''}`,
        };

      case NotificationType.REPLY:
        return {
          title: 'New Reply',
          body: `${actorDisplayName} replied to your post${postPreview ? `: "${postPreview}"` : ''}`,
        };

      case NotificationType.MENTION:
        return {
          title: 'New Mention',
          body: `${actorDisplayName} mentioned you in a post${postPreview ? `: "${postPreview}"` : ''}`,
        };

      case NotificationType.FOLLOW:
        return {
          title: 'New Follower',
          body: `${actorDisplayName} started following you`,
        };

      case NotificationType.DM:
        return {
          title: `Message from ${actorDisplayName}`,
          body: messagePreview || 'New message',
        };

      default:
        return {
          title: 'New Notification',
          body: `${actorDisplayName} interacted with you`,
        };
    }
  }
}
