import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { FirebaseService } from 'src/firebase/firebase.service';
import { Services } from 'src/utils/constants';
import {
  CreateNotificationDto,
  NotificationPayload,
  NotificationPostData,
} from './interfaces/notification.interface';
import { NotificationType, Platform } from './enums/notification.enum';
import { Prisma as PrismalSql } from '@prisma/client';

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

      // Fetch post data for REPLY, QUOTE, MENTION notifications
      if (
        dto.type === NotificationType.REPLY ||
        dto.type === NotificationType.QUOTE ||
        dto.type === NotificationType.MENTION
      ) {
        const postData = await this.fetchPostDataForNotification(notification, dto.recipientId);
        if (postData) {
          payload.post = postData;
        }
      }

      // Sync to Firestore for real-time updates (with post data included)
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

      // Convert payload to plain object for Firestore (including nested post object)
      // Remove undefined values to avoid Firestore errors
      const firestoreData = this.removeUndefinedFields({
        ...payload,
        createdAt: payload.createdAt, // Keep ISO string format
      });

      await notificationRef.set(firestoreData);

      this.logger.debug(`Synced notification ${payload.id} to Firestore`);
    } catch (error) {
      this.logger.error('Failed to sync notification to Firestore', error);
      // Don't throw - Firestore sync failure shouldn't break the flow
    }
  }

  /**
   * Recursively remove undefined fields from an object for Firestore compatibility
   */
  private removeUndefinedFields(obj: any): any {
    if (obj === null || obj === undefined) {
      return null;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.removeUndefinedFields(item));
    }

    if (typeof obj === 'object') {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          cleaned[key] = this.removeUndefinedFields(value);
        }
      }
      return cleaned;
    }

    return obj;
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

    // Add post data if available (added during getNotifications)
    if (notification.post) payload.post = notification.post;

    return payload;
  }

  /**
   * Fetch post data for notification (REPLY, QUOTE, MENTION)
   */
  private async fetchPostDataForNotification(
    notification: any,
    recipientId: number,
  ): Promise<NotificationPostData | null> {
    let postId: number | null = null;

    // Determine which post ID to fetch based on notification type
    if (notification.type === NotificationType.REPLY && notification.replyId) {
      postId = notification.replyId;
    } else if (notification.type === NotificationType.QUOTE && notification.quotePostId) {
      postId = notification.quotePostId;
    } else if (notification.type === NotificationType.MENTION && notification.postId) {
      postId = notification.postId;
    }

    if (!postId) return null;

    try {
      const posts = await this.prismaService.$queryRaw<any[]>(
        PrismalSql.sql`
          SELECT 
            p.id,
            p.user_id,
            p.content,
            p.created_at,
            p.type,
            p.parent_id,
            
            -- User/Author info
            u.username,
            u.is_verifed as "isVerified",
            COALESCE(pr.name, u.username) as "authorName",
            pr.profile_image_url as "authorProfileImage",
            
            -- Engagement counts
            COUNT(DISTINCT l.user_id)::int as "likeCount",
            COUNT(DISTINCT CASE WHEN reply.id IS NOT NULL THEN reply.id END)::int as "replyCount",
            COUNT(DISTINCT r.user_id)::int as "repostCount",
            
            -- User interaction flags
            EXISTS(SELECT 1 FROM "Like" WHERE post_id = p.id AND user_id = ${recipientId}) as "isLikedByMe",
            EXISTS(SELECT 1 FROM follows WHERE "followerId" = ${recipientId} AND "followingId" = p.user_id) as "isFollowedByMe",
            EXISTS(SELECT 1 FROM "Repost" WHERE post_id = p.id AND user_id = ${recipientId}) as "isRepostedByMe",
            
            -- Media URLs (as JSON array)
            COALESCE(
              (SELECT json_agg(json_build_object('url', m.media_url, 'type', m.type))
               FROM "Media" m WHERE m.post_id = p.id),
              '[]'::json
            ) as "mediaUrls",
            
            -- Original post for quotes only
            CASE 
              WHEN p.parent_id IS NOT NULL AND p.type = 'QUOTE' THEN
                (SELECT json_build_object(
                  'postId', op.id,
                  'content', op.content,
                  'createdAt', op.created_at,
                  'likeCount', COALESCE((SELECT COUNT(*)::int FROM "Like" WHERE post_id = op.id), 0),
                  'repostCount', COALESCE((SELECT COUNT(*)::int FROM "Repost" WHERE post_id = op.id), 0),
                  'replyCount', COALESCE((SELECT COUNT(*)::int FROM posts WHERE parent_id = op.id AND is_deleted = false), 0),
                  'isLikedByMe', EXISTS(SELECT 1 FROM "Like" WHERE post_id = op.id AND user_id = ${recipientId}),
                  'isFollowedByMe', EXISTS(SELECT 1 FROM follows WHERE "followerId" = ${recipientId} AND "followingId" = op.user_id),
                  'isRepostedByMe', EXISTS(SELECT 1 FROM "Repost" WHERE post_id = op.id AND user_id = ${recipientId}),
                  'author', json_build_object(
                    'userId', ou.id,
                    'username', ou.username,
                    'isVerified', ou.is_verifed,
                    'name', COALESCE(opr.name, ou.username),
                    'avatar', opr.profile_image_url
                  ),
                  'media', COALESCE(
                    (SELECT json_agg(json_build_object('url', om.media_url, 'type', om.type))
                     FROM "Media" om WHERE om.post_id = op.id),
                    '[]'::json
                  )
                )
                FROM posts op
                LEFT JOIN "User" ou ON ou.id = op.user_id
                LEFT JOIN profiles opr ON opr.user_id = ou.id
                WHERE op.id = p.parent_id AND op.is_deleted = false)
              ELSE NULL
            END as "originalPost"
            
          FROM posts p
          LEFT JOIN "User" u ON u.id = p.user_id
          LEFT JOIN profiles pr ON pr.user_id = u.id
          LEFT JOIN "Like" l ON l.post_id = p.id
          LEFT JOIN "Repost" r ON r.post_id = p.id
          LEFT JOIN posts reply ON reply.parent_id = p.id AND reply.type = 'REPLY' AND reply.is_deleted = false
          WHERE 
            p.is_deleted = false
            AND p.id = ${postId}
          GROUP BY p.id, u.id, u.username, u.is_verifed, pr.name, pr.profile_image_url
        `,
      );

      if (posts.length === 0) return null;

      const post = posts[0];
      const isQuote = post.type === 'QUOTE' && post.parent_id && post.originalPost;

      // Build originalPostData if this is a quote
      let originalPostData: NotificationPostData['originalPostData'] = undefined;
      if (isQuote && post.originalPost) {
        originalPostData = {
          userId: post.originalPost.author.userId,
          username: post.originalPost.author.username,
          verified: post.originalPost.author.isVerified,
          name: post.originalPost.author.name,
          avatar: post.originalPost.author.avatar,
          postId: post.originalPost.postId,
          date: post.originalPost.createdAt,
          likesCount: post.originalPost.likeCount,
          retweetsCount: post.originalPost.repostCount,
          commentsCount: post.originalPost.replyCount,
          isLikedByMe: post.originalPost.isLikedByMe,
          isFollowedByMe: post.originalPost.isFollowedByMe,
          isRepostedByMe: post.originalPost.isRepostedByMe,
          text: post.originalPost.content || '',
          media: post.originalPost.media || [],
        };
      }

      return {
        userId: post.user_id,
        username: post.username,
        verified: post.isVerified,
        name: post.authorName || post.username,
        avatar: post.authorProfileImage,
        postId: post.id,
        date: post.created_at,
        likesCount: post.likeCount,
        retweetsCount: post.repostCount,
        commentsCount: post.replyCount,
        isLikedByMe: post.isLikedByMe,
        isFollowedByMe: post.isFollowedByMe,
        isRepostedByMe: post.isRepostedByMe,
        text: post.content || '',
        media: Array.isArray(post.mediaUrls) ? post.mediaUrls : [],
        isRepost: false,
        isQuote,
        originalPostData,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch post data for notification`, error);
      return null;
    }
  }

  /**
   * Get notifications for a user with pagination
   */
  async getNotifications(
    userId: number,
    page: number = 1,
    limit: number = 20,
    unreadOnly: boolean = false,
    include?: string,
    exclude?: string,
  ) {
    const where: any = { recipientId: userId };
    if (unreadOnly) {
      where.isRead = false;
    }

    // Handle include/exclude filters for notification types
    if (include) {
      const includeTypes = include.split(',').map((type) => type.trim().toUpperCase());
      where.type = { in: includeTypes };
    } else if (exclude) {
      const excludeTypes = exclude.split(',').map((type) => type.trim().toUpperCase());
      where.type = { notIn: excludeTypes };
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

    // Fetch post data for REPLY, QUOTE, MENTION notifications
    const notificationsWithPosts = await Promise.all(
      notifications.map(async (notification) => {
        const notificationWithPost: any = { ...notification, post: undefined };

        if (
          notification.type === NotificationType.REPLY ||
          notification.type === NotificationType.QUOTE ||
          notification.type === NotificationType.MENTION
        ) {
          const postData = await this.fetchPostDataForNotification(notification, userId);
          if (postData) {
            notificationWithPost.post = postData;
          }
        }

        return notificationWithPost;
      }),
    );

    const data = notificationsWithPosts.map((notification) =>
      this.buildNotificationPayload(notification),
    );

    return {
      data,
      metadata: {
        totalItems,
        page,
        limit,
        totalPages: Math.ceil(totalItems / limit),
      },
    };
  }

  /**
   * Get unread notifications count for a user
   */
  async getUnreadCount(userId: number, include?: string, exclude?: string): Promise<number> {
    const where: any = { recipientId: userId, isRead: false };

    // Handle include/exclude filters for notification types
    if (include) {
      const includeTypes = include.split(',').map((type) => type.trim().toUpperCase());
      where.type = { in: includeTypes };
    } else if (exclude) {
      const excludeTypes = exclude.split(',').map((type) => type.trim().toUpperCase());
      where.type = { notIn: excludeTypes };
    }

    return this.prismaService.notification.count({ where });
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
