import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { FirebaseService } from 'src/firebase/firebase.service';
import { Services } from 'src/utils/constants';
import { CreateNotificationDto, NotificationPayload } from './interfaces/notification.interface';
import { NotificationType, Platform } from './enums/notification.enum';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @Inject(Services.PRISMA)
    private readonly prismaService: PrismaService,
    @Inject(Services.FIREBASE)
    private readonly firebaseService: FirebaseService,
  ) {}

  /**
   * Create a notification in Prisma (source of truth) and sync to Firestore
   */
  async createNotification(dto: CreateNotificationDto): Promise<NotificationPayload | null> {
    try {
      // Optional: Check for duplicates before attempting creation (early exit optimization)
      const isDuplicate = await this.checkDuplicateNotification(dto);
      if (isDuplicate) {
        this.logger.debug(
          `Duplicate notification prevented: ${dto.type} for user ${dto.recipientId} by ${dto.actorId}`,
        );
        return null;
      }

      // Create notification in Prisma
      const notification = await this.prismaService.notification.create({
        data: {
          type: dto.type,
          recipientId: dto.recipientId,
          actorId: dto.actorId,
          actorUsername: dto.actorUsername,
          actorDisplayName: dto.actorDisplayName,
          actorAvatarUrl: dto.actorAvatarUrl,
          postId: dto.postId,
          quotePostId: dto.quotePostId,
          replyId: dto.replyId,
          threadPostId: dto.threadPostId,
          postPreviewText: dto.postPreviewText,
          conversationId: dto.conversationId,
          messagePreview: dto.messagePreview,
        },
      });

      // Build notification payload
      const payload = this.buildNotificationPayload(notification);

      // Sync to Firestore for real-time updates
      await this.syncToFirestore(payload);

      this.logger.log(
        `Notification created: ${notification.type} for user ${dto.recipientId} by ${dto.actorId}`,
      );

      return payload;
    } catch (error) {
      // Handle unique constraint violation gracefully (P2002 = Prisma unique constraint error)
      if (error.code === 'P2002') {
        this.logger.debug(
          `Duplicate notification prevented by database constraint: ${dto.type} for user ${dto.recipientId}`,
        );
        return null; // Exit gracefully - this is expected behavior
      }

      this.logger.error('Failed to create notification', error);
      throw error;
    }
  }

  /**
   * Sync notification to Firestore for real-time updates
   */
  private async syncToFirestore(payload: NotificationPayload): Promise<void> {
    try {
      const firestore = this.firebaseService.getFirestore();
      const notificationRef = firestore
        .collection('users')
        .doc(payload.recipientId.toString())
        .collection('notifications')
        .doc(payload.id);

      await notificationRef.set({
        ...payload,
        createdAt: payload.createdAt, // Keep ISO string format
      });

      this.logger.debug(`Synced notification ${payload.id} to Firestore`);
    } catch (error) {
      this.logger.error('Failed to sync notification to Firestore', error);
      // Don't throw - Firestore sync failure shouldn't break the flow
    }
  }

  /**
   * Check if a duplicate notification already exists
   * Returns true if duplicate exists, false otherwise
   */
  private async checkDuplicateNotification(dto: CreateNotificationDto): Promise<boolean> {
    const whereClause = this.buildUniqueWhereClause(dto);

    if (!whereClause) {
      // No deduplication needed for this type (e.g., DM)
      return false;
    }

    const existing = await this.prismaService.notification.findFirst({
      where: whereClause,
    });

    return existing !== null;
  }

  /**
   * Build where clause for duplicate checking based on notification type
   */
  private buildUniqueWhereClause(dto: CreateNotificationDto): any {
    switch (dto.type) {
      case NotificationType.LIKE:
        return dto.postId
          ? {
              type: NotificationType.LIKE,
              recipientId: dto.recipientId,
              actorId: dto.actorId,
              postId: dto.postId,
            }
          : null;

      case NotificationType.REPOST:
        return dto.postId
          ? {
              type: NotificationType.REPOST,
              recipientId: dto.recipientId,
              actorId: dto.actorId,
              postId: dto.postId,
            }
          : null;

      case NotificationType.FOLLOW:
        return {
          type: NotificationType.FOLLOW,
          recipientId: dto.recipientId,
          actorId: dto.actorId,
        };

      case NotificationType.MENTION:
        return dto.postId
          ? {
              type: NotificationType.MENTION,
              recipientId: dto.recipientId,
              actorId: dto.actorId,
              postId: dto.postId,
            }
          : null;

      case NotificationType.QUOTE:
        return dto.quotePostId
          ? {
              type: NotificationType.QUOTE,
              recipientId: dto.recipientId,
              actorId: dto.actorId,
              quotePostId: dto.quotePostId,
            }
          : null;

      case NotificationType.REPLY:
        return dto.replyId
          ? {
              type: NotificationType.REPLY,
              recipientId: dto.recipientId,
              actorId: dto.actorId,
              replyId: dto.replyId,
            }
          : null;

      case NotificationType.DM:
        // No deduplication for DMs - each message is unique
        return null;

      default:
        return null;
    }
  }

  /**
   * Send push notification via FCM
   */
  async sendPushNotification(
    userId: number,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    try {
      // Get user's device tokens
      const deviceTokens = await this.prismaService.deviceToken.findMany({
        where: { userId },
        select: { token: true, platform: true },
      });

      if (deviceTokens.length === 0) {
        this.logger.debug(`No device tokens found for user ${userId}`);
        return;
      }

      const messaging = this.firebaseService.getMessaging();
      const tokens = deviceTokens.map((dt) => dt.token);

      // Send to all devices
      const response = await messaging.sendEachForMulticast({
        tokens,
        notification: {
          title,
          body,
        },
        data: data || {},
      });

      this.logger.log(
        `Push notification sent to ${response.successCount}/${tokens.length} devices for user ${userId}`,
      );

      // Handle failed tokens (invalid/expired)
      if (response.failureCount > 0) {
        await this.handleFailedTokens(response.responses, tokens);
      }
    } catch (error) {
      this.logger.error(`Failed to send push notification to user ${userId}`, error);
      // Don't throw - push notification failure shouldn't break the flow
    }
  }

  /**
   * Remove invalid/expired FCM tokens
   */
  private async handleFailedTokens(responses: any[], tokens: string[]): Promise<void> {
    const invalidTokens: string[] = [];

    responses.forEach((response, index) => {
      if (!response.success) {
        const errorCode = response.error?.code;
        // Remove tokens that are invalid, not registered, or expired
        if (
          errorCode === 'messaging/invalid-registration-token' ||
          errorCode === 'messaging/registration-token-not-registered'
        ) {
          invalidTokens.push(tokens[index]);
        }
      }
    });

    if (invalidTokens.length > 0) {
      await this.prismaService.deviceToken.deleteMany({
        where: { token: { in: invalidTokens } },
      });
      this.logger.log(`Removed ${invalidTokens.length} invalid device tokens`);
    }
  }

  /**
   * Build notification payload for API response and Firestore
   */
  private buildNotificationPayload(notification: any): NotificationPayload {
    const payload: NotificationPayload = {
      id: notification.id,
      type: notification.type as NotificationType,
      recipientId: notification.recipientId,
      actor: {
        id: notification.actorId,
        username: notification.actorUsername,
        displayName: notification.actorDisplayName,
        avatarUrl: notification.actorAvatarUrl,
      },
      isRead: notification.isRead,
      createdAt: notification.createdAt.toISOString(),
    };

    // Add post-related fields
    if (notification.postId) payload.postId = notification.postId;
    if (notification.quotePostId) payload.quotePostId = notification.quotePostId;
    if (notification.replyId) payload.replyId = notification.replyId;
    if (notification.threadPostId) payload.threadPostId = notification.threadPostId;
    if (notification.postPreviewText) payload.postPreviewText = notification.postPreviewText;

    // Add DM-related fields
    if (notification.conversationId) payload.conversationId = notification.conversationId;
    if (notification.messagePreview) payload.messagePreview = notification.messagePreview;

    return payload;
  }

  /**
   * Get notifications for a user with pagination
   */
  async getNotifications(
    userId: number,
    page: number = 1,
    limit: number = 20,
    unreadOnly: boolean = false,
  ) {
    const where: any = { recipientId: userId };
    if (unreadOnly) {
      where.isRead = false;
    }

    const [totalItems, notifications, unreadCount] = await Promise.all([
      this.prismaService.notification.count({ where }),
      this.prismaService.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prismaService.notification.count({
        where: { recipientId: userId, isRead: false },
      }),
    ]);

    const data = notifications.map((notification) => this.buildNotificationPayload(notification));

    return {
      data,
      metadata: {
        totalItems,
        page,
        limit,
        totalPages: Math.ceil(totalItems / limit),
        unreadCount,
      },
    };
  }

  /**
   * Get unread notifications count for a user
   */
  async getUnreadCount(userId: number): Promise<number> {
    return this.prismaService.notification.count({
      where: { recipientId: userId, isRead: false },
    });
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: string, userId: number): Promise<void> {
    const notification = await this.prismaService.notification.findFirst({
      where: { id: notificationId, recipientId: userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.isRead) {
      return; // Already read
    }

    // Update in Prisma
    await this.prismaService.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    // Update in Firestore
    try {
      const firestore = this.firebaseService.getFirestore();
      await firestore
        .collection('users')
        .doc(userId.toString())
        .collection('notifications')
        .doc(notificationId)
        .update({ isRead: true });
    } catch (error) {
      this.logger.error('Failed to update notification in Firestore', error);
    }

    this.logger.debug(`Notification ${notificationId} marked as read`);
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: number): Promise<void> {
    // Update in Prisma
    await this.prismaService.notification.updateMany({
      where: { recipientId: userId, isRead: false },
      data: { isRead: true },
    });

    // Update in Firestore (batch update)
    try {
      const firestore = this.firebaseService.getFirestore();
      const notificationsRef = firestore
        .collection('users')
        .doc(userId.toString())
        .collection('notifications');

      const unreadNotifications = await notificationsRef.where('isRead', '==', false).get();

      const batch = firestore.batch();
      unreadNotifications.docs.forEach((doc) => {
        batch.update(doc.ref, { isRead: true });
      });

      await batch.commit();
    } catch (error) {
      this.logger.error('Failed to mark all notifications as read in Firestore', error);
    }

    this.logger.log(`All notifications marked as read for user ${userId}`);
  }

  /**
   * Register a device token for push notifications
   */
  async registerDevice(userId: number, token: string, platform: Platform): Promise<void> {
    try {
      // Upsert device token
      await this.prismaService.deviceToken.upsert({
        where: { token },
        update: { userId, platform, updatedAt: new Date() },
        create: { userId, token, platform },
      });

      this.logger.log(`Device token registered for user ${userId} on ${platform}`);
    } catch (error) {
      this.logger.error('Failed to register device token', error);
      throw error;
    }
  }

  /**
   * Remove a device token
   */
  async removeDevice(token: string): Promise<void> {
    try {
      await this.prismaService.deviceToken.delete({
        where: { token },
      });

      this.logger.log(`Device token removed: ${token}`);
    } catch (error) {
      if (error.code === 'P2025') {
        this.logger.debug(`Device token not found: ${token}`);
        return;
      }

      this.logger.error('Failed to remove device token', error);
      throw error;
    }
  }

  /**
   * Truncate text to specified length and add ellipsis
   */
  truncateText(text: string, maxLength: number = 100): string {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }
}
