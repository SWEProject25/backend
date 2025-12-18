import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from './notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseService } from '../firebase/firebase.service';
import { Services } from '../utils/constants';
import { NotificationType, Platform } from './enums/notification.enum';
import { NotFoundException } from '@nestjs/common';

describe('NotificationService', () => {
  let service: NotificationService;
  let prismaService: any;
  let firebaseService: any;

  const mockFirestore = {
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockReturnThis(),
    set: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    where: jest.fn().mockReturnThis(),
    get: jest.fn().mockResolvedValue({ docs: [] }),
  };

  const mockMessaging = {
    sendEachForMulticast: jest.fn(),
  };

  const mockBatch = {
    update: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: Services.PRISMA,
          useValue: {
            notification: {
              create: jest.fn(),
              findFirst: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn(),
            },
            deviceToken: {
              findMany: jest.fn(),
              upsert: jest.fn(),
              delete: jest.fn(),
              deleteMany: jest.fn(),
            },
            post: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: Services.FIREBASE,
          useValue: {
            getFirestore: jest.fn().mockReturnValue({
              ...mockFirestore,
              batch: jest.fn().mockReturnValue(mockBatch),
            }),
            getMessaging: jest.fn().mockReturnValue(mockMessaging),
          },
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    prismaService = module.get(Services.PRISMA);
    firebaseService = module.get(Services.FIREBASE);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createNotification', () => {
    it('should create a notification in Prisma and sync to Firestore', async () => {
      const mockNotification = {
        id: 'notif-123',
        type: NotificationType.LIKE,
        recipientId: 1,
        actorId: 2,
        actorUsername: 'john_doe',
        actorAvatarUrl: 'https://example.com/avatar.jpg',
        postId: 456,
        quotePostId: null,
        replyId: null,
        threadPostId: null,
        postPreviewText: 'Great post!',
        conversationId: null,
        messagePreview: null,
        isRead: false,
        createdAt: new Date('2025-11-29T10:00:00Z'),
      };

      // Mock findFirst to return null (no duplicate found)
      prismaService.notification.findFirst.mockResolvedValue(null);
      prismaService.notification.create.mockResolvedValue(mockNotification as any);

      const dto = {
        type: NotificationType.LIKE,
        recipientId: 1,
        actorId: 2,
        actorUsername: 'john_doe',
        actorAvatarUrl: 'https://example.com/avatar.jpg',
        postId: 456,
        postPreviewText: 'Great post!',
      };

      const result = await service.createNotification(dto);

      expect(prismaService.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: NotificationType.LIKE,
          recipientId: 1,
          actorId: 2,
        }),
      });

      expect(result).toEqual({
        id: 'notif-123',
        type: NotificationType.LIKE,
        recipientId: 1,
        actor: {
          id: 2,
          username: 'john_doe',
          displayName: undefined,
          avatarUrl: 'https://example.com/avatar.jpg',
        },
        postId: 456,
        postPreviewText: 'Great post!',
        isRead: false,
        createdAt: '2025-11-29T10:00:00.000Z',
      });

      expect(mockFirestore.collection).toHaveBeenCalledWith('users');
      expect(mockFirestore.set).toHaveBeenCalled();
    });

    it('should handle FOLLOW notification without post data', async () => {
      const mockNotification = {
        id: 'notif-789',
        type: NotificationType.FOLLOW,
        recipientId: 1,
        actorId: 3,
        actorUsername: 'jane_smith',
        actorAvatarUrl: null,
        postId: null,
        quotePostId: null,
        replyId: null,
        threadPostId: null,
        postPreviewText: null,
        conversationId: null,
        messagePreview: null,
        isRead: false,
        createdAt: new Date('2025-11-29T11:00:00Z'),
      };

      // FOLLOW notification doesn't need duplicate check
      prismaService.notification.findFirst.mockResolvedValue(null);
      prismaService.notification.create.mockResolvedValue(mockNotification as any);

      const dto = {
        type: NotificationType.FOLLOW,
        recipientId: 1,
        actorId: 3,
        actorUsername: 'jane_smith',
      };

      const result = await service.createNotification(dto);

      expect(result).not.toBeNull();
      expect(result!.type).toBe(NotificationType.FOLLOW);
      expect(result!.postId).toBeUndefined();
      expect(result!.actor.username).toBe('jane_smith');
    });

    it('should handle DM notification with conversation data', async () => {
      const mockNotification = {
        id: 'notif-dm-1',
        type: NotificationType.DM,
        recipientId: 1,
        actorId: 4,
        actorUsername: 'bob_wilson',
        actorAvatarUrl: 'https://example.com/bob.jpg',
        postId: null,
        quotePostId: null,
        replyId: null,
        threadPostId: null,
        postPreviewText: null,
        conversationId: 123,
        messagePreview: 'Hey, how are you?',
        isRead: false,
        createdAt: new Date('2025-11-29T12:00:00Z'),
      };

      // DM notification doesn't check for duplicates
      prismaService.notification.findFirst.mockResolvedValue(null);
      prismaService.notification.create.mockResolvedValue(mockNotification as any);

      const dto = {
        type: NotificationType.DM,
        recipientId: 1,
        actorId: 4,
        actorUsername: 'bob_wilson',
        actorAvatarUrl: 'https://example.com/bob.jpg',
        conversationId: 123,
        messagePreview: 'Hey, how are you?',
      };

      const result = await service.createNotification(dto);

      expect(result).not.toBeNull();
      expect(result!.type).toBe(NotificationType.DM);
      expect(result!.conversationId).toBe(123);
      expect(result!.messagePreview).toBe('Hey, how are you?');
    });

    it('should return null for duplicate notification', async () => {
      // Mock findFirst to return an existing notification (duplicate found)
      prismaService.notification.findFirst.mockResolvedValue({
        id: 'existing-notif',
        type: NotificationType.LIKE,
        recipientId: 1,
        actorId: 2,
        postId: 100,
      } as any);

      const dto = {
        type: NotificationType.LIKE,
        recipientId: 1,
        actorId: 2,
        actorUsername: 'john_doe',
        postId: 100,
      };

      const result = await service.createNotification(dto);

      expect(result).toBeNull();
      expect(prismaService.notification.create).not.toHaveBeenCalled();
    });

    it('should handle REPLY notification with post data fetch', async () => {
      const mockNotification = {
        id: 'notif-reply-1',
        type: NotificationType.REPLY,
        recipientId: 1,
        actorId: 2,
        actorUsername: 'replier',
        actorAvatarUrl: null,
        postId: null,
        quotePostId: null,
        replyId: 500,
        threadPostId: 400,
        postPreviewText: 'Reply content',
        conversationId: null,
        messagePreview: null,
        isRead: false,
        createdAt: new Date(),
      };

      prismaService.notification.findFirst.mockResolvedValue(null);
      prismaService.notification.create.mockResolvedValue(mockNotification as any);
      // Mock the post data fetch for REPLY
      prismaService.post.findUnique.mockResolvedValue({
        id: 500,
        content: 'Reply text',
        userId: 2,
        author: { username: 'replier' },
      } as any);

      const dto = {
        type: NotificationType.REPLY,
        recipientId: 1,
        actorId: 2,
        actorUsername: 'replier',
        replyId: 500,
        threadPostId: 400,
      };

      const result = await service.createNotification(dto);

      expect(result).not.toBeNull();
      expect(result!.type).toBe(NotificationType.REPLY);
    });

    it('should return null on P2002 unique constraint violation', async () => {
      const prismaError = new Error('Unique constraint violation');
      (prismaError as any).code = 'P2002';

      prismaService.notification.findFirst.mockResolvedValue(null);
      prismaService.notification.create.mockRejectedValue(prismaError);

      const dto = {
        type: NotificationType.LIKE,
        recipientId: 1,
        actorId: 2,
        actorUsername: 'john_doe',
        postId: 100,
      };

      const result = await service.createNotification(dto);

      expect(result).toBeNull();
    });

    it('should rethrow non-P2002 errors', async () => {
      const genericError = new Error('Database connection failed');

      prismaService.notification.findFirst.mockResolvedValue(null);
      prismaService.notification.create.mockRejectedValue(genericError);

      const dto = {
        type: NotificationType.LIKE,
        recipientId: 1,
        actorId: 2,
        actorUsername: 'john_doe',
        postId: 100,
      };

      await expect(service.createNotification(dto)).rejects.toThrow('Database connection failed');
    });
  });

  describe('getNotifications', () => {
    it('should return paginated notifications', async () => {
      const mockNotifications = [
        {
          id: 'notif-1',
          type: NotificationType.LIKE,
          recipientId: 1,
          actorId: 2,
          actorUsername: 'user2',
          actorAvatarUrl: null,
          postId: 'post-1',
          isRead: false,
          createdAt: new Date(),
        },
        {
          id: 'notif-2',
          type: NotificationType.FOLLOW,
          recipientId: 1,
          actorId: 3,
          actorUsername: 'user3',
          actorAvatarUrl: null,
          postId: null,
          isRead: true,
          createdAt: new Date(),
        },
      ];

      prismaService.notification.count.mockResolvedValueOnce(10); // total
      prismaService.notification.findMany.mockResolvedValue(mockNotifications as any);
      prismaService.notification.count.mockResolvedValueOnce(5); // unread

      const result = await service.getNotifications(1, 1, 20, false);

      expect(result.data).toHaveLength(2);
      expect(result.metadata.totalItems).toBe(10);
      expect(result.metadata.page).toBe(1);
      expect(result.metadata.limit).toBe(20);
      expect(result.metadata.totalPages).toBe(1);
    });

    it('should filter unread notifications only', async () => {
      prismaService.notification.count.mockResolvedValueOnce(5);
      prismaService.notification.findMany.mockResolvedValue([]);
      prismaService.notification.count.mockResolvedValueOnce(5);

      await service.getNotifications(1, 1, 20, true);

      expect(prismaService.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { recipientId: 1, isRead: false },
        }),
      );
    });

    it('should filter by include types', async () => {
      prismaService.notification.count.mockResolvedValueOnce(3);
      prismaService.notification.findMany.mockResolvedValue([]);
      prismaService.notification.count.mockResolvedValueOnce(3);

      await service.getNotifications(1, 1, 20, false, 'LIKE,FOLLOW');

      expect(prismaService.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { recipientId: 1, type: { in: ['LIKE', 'FOLLOW'] } },
        }),
      );
    });

    it('should filter by exclude types', async () => {
      prismaService.notification.count.mockResolvedValueOnce(8);
      prismaService.notification.findMany.mockResolvedValue([]);
      prismaService.notification.count.mockResolvedValueOnce(5);

      await service.getNotifications(1, 1, 20, false, undefined, 'DM,MENTION');

      expect(prismaService.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { recipientId: 1, type: { notIn: ['DM', 'MENTION'] } },
        }),
      );
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count for user', async () => {
      prismaService.notification.count.mockResolvedValue(5);

      const result = await service.getUnreadCount(1);

      expect(result).toBe(5);
      expect(prismaService.notification.count).toHaveBeenCalledWith({
        where: { recipientId: 1, isRead: false },
      });
    });

    it('should filter by include types', async () => {
      prismaService.notification.count.mockResolvedValue(3);

      await service.getUnreadCount(1, 'LIKE,FOLLOW');

      expect(prismaService.notification.count).toHaveBeenCalledWith({
        where: { recipientId: 1, isRead: false, type: { in: ['LIKE', 'FOLLOW'] } },
      });
    });

    it('should filter by exclude types', async () => {
      prismaService.notification.count.mockResolvedValue(10);

      await service.getUnreadCount(1, undefined, 'DM');

      expect(prismaService.notification.count).toHaveBeenCalledWith({
        where: { recipientId: 1, isRead: false, type: { notIn: ['DM'] } },
      });
    });

    it('should return zero when no unread notifications', async () => {
      prismaService.notification.count.mockResolvedValue(0);

      const result = await service.getUnreadCount(1);

      expect(result).toBe(0);
    });
  });

  describe('markAsRead', () => {
    it('should mark a notification as read in Prisma and Firestore', async () => {
      const mockNotification = {
        id: 'notif-123',
        recipientId: 1,
        isRead: false,
      };

      prismaService.notification.findFirst.mockResolvedValue(mockNotification as any);
      prismaService.notification.update.mockResolvedValue({
        ...mockNotification,
        isRead: true,
      } as any);

      await service.markAsRead('notif-123', 1);

      expect(prismaService.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-123' },
        data: { isRead: true },
      });

      expect(mockFirestore.update).toHaveBeenCalledWith({ isRead: true });
    });

    it('should throw NotFoundException if notification not found', async () => {
      prismaService.notification.findFirst.mockResolvedValue(null);

      await expect(service.markAsRead('notif-999', 1)).rejects.toThrow(NotFoundException);
    });

    it('should not update if already read', async () => {
      const mockNotification = {
        id: 'notif-123',
        recipientId: 1,
        isRead: true,
      };

      prismaService.notification.findFirst.mockResolvedValue(mockNotification as any);

      await service.markAsRead('notif-123', 1);

      expect(prismaService.notification.update).not.toHaveBeenCalled();
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all unread notifications as read', async () => {
      const mockUnreadDocs = [{ ref: { id: 'notif-1' } }, { ref: { id: 'notif-2' } }];

      mockFirestore.get.mockResolvedValue({ docs: mockUnreadDocs } as any);

      await service.markAllAsRead(1);

      expect(prismaService.notification.updateMany).toHaveBeenCalledWith({
        where: { recipientId: 1, isRead: false },
        data: { isRead: true },
      });

      expect(mockBatch.commit).toHaveBeenCalled();
    });
  });

  describe('sendPushNotification', () => {
    it('should send push notification to all user devices', async () => {
      const mockDeviceTokens = [
        { token: 'token-1', platform: Platform.IOS },
        { token: 'token-2', platform: Platform.ANDROID },
      ];

      prismaService.deviceToken.findMany.mockResolvedValue(mockDeviceTokens as any);
      mockMessaging.sendEachForMulticast.mockResolvedValue({
        successCount: 2,
        failureCount: 0,
        responses: [],
      });

      await service.sendPushNotification(1, 'New Like', 'John liked your post');

      expect(mockMessaging.sendEachForMulticast).toHaveBeenCalledWith({
        tokens: ['token-1', 'token-2'],
        notification: {
          title: 'New Like',
          body: 'John liked your post',
        },
        data: {},
      });
    });

    it('should handle invalid tokens and remove them', async () => {
      const mockDeviceTokens = [
        { token: 'valid-token', platform: Platform.WEB },
        { token: 'invalid-token', platform: Platform.IOS },
      ];

      prismaService.deviceToken.findMany.mockResolvedValue(mockDeviceTokens as any);
      mockMessaging.sendEachForMulticast.mockResolvedValue({
        successCount: 1,
        failureCount: 1,
        responses: [
          { success: true },
          {
            success: false,
            error: { code: 'messaging/invalid-registration-token' },
          },
        ],
      });

      await service.sendPushNotification(1, 'Test', 'Test message');

      expect(prismaService.deviceToken.deleteMany).toHaveBeenCalledWith({
        where: { token: { in: ['invalid-token'] } },
      });
    });

    it('should not send if no device tokens found', async () => {
      prismaService.deviceToken.findMany.mockResolvedValue([]);

      await service.sendPushNotification(1, 'Test', 'Test message');

      expect(mockMessaging.sendEachForMulticast).not.toHaveBeenCalled();
    });
  });

  describe('registerDevice', () => {
    it('should register a new device token', async () => {
      prismaService.deviceToken.upsert.mockResolvedValue({
        id: 'device-1',
        userId: 1,
        token: 'new-token',
        platform: Platform.ANDROID,
      } as any);

      await service.registerDevice(1, 'new-token', Platform.ANDROID);

      expect(prismaService.deviceToken.upsert).toHaveBeenCalledWith({
        where: { token: 'new-token' },
        update: expect.objectContaining({
          userId: 1,
          platform: Platform.ANDROID,
        }),
        create: {
          userId: 1,
          token: 'new-token',
          platform: Platform.ANDROID,
        },
      });
    });
  });

  describe('removeDevice', () => {
    it('should remove a device token', async () => {
      prismaService.deviceToken.delete.mockResolvedValue({} as any);

      await service.removeDevice('token-to-remove');

      expect(prismaService.deviceToken.delete).toHaveBeenCalledWith({
        where: { token: 'token-to-remove' },
      });
    });

    it('should handle P2025 (token not found) gracefully', async () => {
      const notFoundError = new Error('Record not found');
      (notFoundError as any).code = 'P2025';
      prismaService.deviceToken.delete.mockRejectedValue(notFoundError);

      await expect(service.removeDevice('non-existent-token')).resolves.not.toThrow();
    });

    it('should rethrow non-P2025 errors', async () => {
      const genericError = new Error('Database error');
      prismaService.deviceToken.delete.mockRejectedValue(genericError);

      await expect(service.removeDevice('some-token')).rejects.toThrow('Database error');
    });
  });

  describe('truncateText', () => {
    it('should return original text if within limit', () => {
      const text = 'Short text';
      expect(service.truncateText(text, 100)).toBe('Short text');
    });

    it('should truncate text and add ellipsis', () => {
      const text = 'a'.repeat(150);
      const result = service.truncateText(text, 100);
      expect(result).toHaveLength(103); // 100 + '...'
      expect(result.endsWith('...')).toBe(true);
    });

    it('should handle empty text', () => {
      expect(service.truncateText('', 100)).toBe('');
    });
  });

  describe('createNotification - additional scenarios', () => {
    it('should handle QUOTE notification with post data fetch', async () => {
      const mockNotification = {
        id: 'notif-quote-1',
        type: NotificationType.QUOTE,
        recipientId: 1,
        actorId: 2,
        actorUsername: 'quoter',
        actorAvatarUrl: null,
        postId: null,
        quotePostId: 300,
        replyId: null,
        threadPostId: null,
        postPreviewText: null,
        conversationId: null,
        messagePreview: null,
        isRead: false,
        createdAt: new Date(),
      };

      prismaService.notification.findFirst.mockResolvedValue(null);
      prismaService.notification.create.mockResolvedValue(mockNotification as any);
      prismaService.$queryRaw = jest.fn().mockResolvedValue([{
        id: 300,
        user_id: 2,
        username: 'quoter',
        isVerified: false,
        authorName: 'Quoter User',
        authorProfileImage: null,
        likeCount: 5,
        replyCount: 2,
        repostCount: 1,
        isLikedByMe: false,
        isFollowedByMe: true,
        isRepostedByMe: false,
        content: 'Quoted post content',
        mediaUrls: [],
        type: 'QUOTE',
        parent_id: 200,
        created_at: new Date(),
      }]);

      const dto = {
        type: NotificationType.QUOTE,
        recipientId: 1,
        actorId: 2,
        actorUsername: 'quoter',
        quotePostId: 300,
      };

      const result = await service.createNotification(dto);

      expect(result).not.toBeNull();
      expect(result!.type).toBe(NotificationType.QUOTE);
    });

    it('should handle MENTION notification with post data fetch', async () => {
      const mockNotification = {
        id: 'notif-mention-1',
        type: NotificationType.MENTION,
        recipientId: 1,
        actorId: 2,
        actorUsername: 'mentioner',
        actorAvatarUrl: null,
        postId: 400,
        quotePostId: null,
        replyId: null,
        threadPostId: null,
        postPreviewText: 'Hey @user check this out',
        conversationId: null,
        messagePreview: null,
        isRead: false,
        createdAt: new Date(),
      };

      prismaService.notification.findFirst.mockResolvedValue(null);
      prismaService.notification.create.mockResolvedValue(mockNotification as any);
      prismaService.$queryRaw = jest.fn().mockResolvedValue([{
        id: 400,
        user_id: 2,
        username: 'mentioner',
        isVerified: true,
        authorName: 'Mentioner',
        authorProfileImage: 'https://example.com/avatar.jpg',
        likeCount: 10,
        replyCount: 3,
        repostCount: 2,
        isLikedByMe: true,
        isFollowedByMe: false,
        isRepostedByMe: false,
        content: 'Hey @user check this out',
        mediaUrls: [{ url: 'https://example.com/image.jpg', type: 'image' }],
        type: 'POST',
        parent_id: null,
        created_at: new Date(),
      }]);

      const dto = {
        type: NotificationType.MENTION,
        recipientId: 1,
        actorId: 2,
        actorUsername: 'mentioner',
        postId: 400,
      };

      const result = await service.createNotification(dto);

      expect(result).not.toBeNull();
      expect(result!.type).toBe(NotificationType.MENTION);
    });

    it('should handle REPOST notification without postId', async () => {
      const mockNotification = {
        id: 'notif-repost-1',
        type: NotificationType.REPOST,
        recipientId: 1,
        actorId: 2,
        actorUsername: 'reposter',
        actorAvatarUrl: null,
        postId: null,
        quotePostId: null,
        replyId: null,
        threadPostId: null,
        postPreviewText: null,
        conversationId: null,
        messagePreview: null,
        isRead: false,
        createdAt: new Date(),
      };

      // REPOST without postId returns null whereClause, so no duplicate check
      prismaService.notification.findFirst.mockResolvedValue(null);
      prismaService.notification.create.mockResolvedValue(mockNotification as any);

      const dto = {
        type: NotificationType.REPOST,
        recipientId: 1,
        actorId: 2,
        actorUsername: 'reposter',
        // No postId - tests null whereClause branch
      };

      const result = await service.createNotification(dto);

      expect(result).not.toBeNull();
    });

    it('should handle MENTION without postId (null whereClause)', async () => {
      const mockNotification = {
        id: 'notif-mention-2',
        type: NotificationType.MENTION,
        recipientId: 1,
        actorId: 2,
        actorUsername: 'mentioner',
        actorAvatarUrl: null,
        postId: null,
        quotePostId: null,
        replyId: null,
        threadPostId: null,
        postPreviewText: null,
        conversationId: null,
        messagePreview: null,
        isRead: false,
        createdAt: new Date(),
      };

      prismaService.notification.findFirst.mockResolvedValue(null);
      prismaService.notification.create.mockResolvedValue(mockNotification as any);

      const dto = {
        type: NotificationType.MENTION,
        recipientId: 1,
        actorId: 2,
        actorUsername: 'mentioner',
        // No postId
      };

      const result = await service.createNotification(dto);

      expect(result).not.toBeNull();
    });

    it('should handle QUOTE without quotePostId (null whereClause)', async () => {
      const mockNotification = {
        id: 'notif-quote-2',
        type: NotificationType.QUOTE,
        recipientId: 1,
        actorId: 2,
        actorUsername: 'quoter',
        actorAvatarUrl: null,
        postId: null,
        quotePostId: null,
        replyId: null,
        threadPostId: null,
        postPreviewText: null,
        conversationId: null,
        messagePreview: null,
        isRead: false,
        createdAt: new Date(),
      };

      prismaService.notification.findFirst.mockResolvedValue(null);
      prismaService.notification.create.mockResolvedValue(mockNotification as any);

      const dto = {
        type: NotificationType.QUOTE,
        recipientId: 1,
        actorId: 2,
        actorUsername: 'quoter',
        // No quotePostId
      };

      const result = await service.createNotification(dto);

      expect(result).not.toBeNull();
    });

    it('should handle unknown notification type (default whereClause)', async () => {
      const mockNotification = {
        id: 'notif-unknown-1',
        type: 'UNKNOWN_TYPE' as any,
        recipientId: 1,
        actorId: 2,
        actorUsername: 'user',
        actorAvatarUrl: null,
        postId: null,
        quotePostId: null,
        replyId: null,
        threadPostId: null,
        postPreviewText: null,
        conversationId: null,
        messagePreview: null,
        isRead: false,
        createdAt: new Date(),
      };

      prismaService.notification.findFirst.mockResolvedValue(null);
      prismaService.notification.create.mockResolvedValue(mockNotification as any);

      const dto = {
        type: 'UNKNOWN_TYPE' as any,
        recipientId: 1,
        actorId: 2,
        actorUsername: 'user',
      };

      const result = await service.createNotification(dto);

      expect(result).not.toBeNull();
    });
  });

  describe('sendPushNotification - error handling', () => {
    it('should catch and log error without throwing', async () => {
      prismaService.deviceToken.findMany.mockRejectedValue(new Error('Database error'));

      // Should not throw
      await expect(service.sendPushNotification(1, 'Title', 'Body')).resolves.not.toThrow();
    });
  });

  describe('registerDevice - error handling', () => {
    it('should rethrow errors on registration failure', async () => {
      prismaService.deviceToken.upsert.mockRejectedValue(new Error('Upsert failed'));

      await expect(service.registerDevice(1, 'token', Platform.IOS)).rejects.toThrow('Upsert failed');
    });
  });

  describe('markAsRead - Firestore error handling', () => {
    it('should continue if Firestore update fails', async () => {
      const mockNotification = {
        id: 'notif-1',
        recipientId: 1,
        isRead: false,
      };

      prismaService.notification.findFirst.mockResolvedValue(mockNotification as any);
      prismaService.notification.update.mockResolvedValue({ ...mockNotification, isRead: true } as any);

      // Make Firestore update throw
      const mockFirestoreWithError = {
        collection: jest.fn().mockReturnThis(),
        doc: jest.fn().mockReturnThis(),
        update: jest.fn().mockRejectedValue(new Error('Firestore error')),
      };
      firebaseService.getFirestore.mockReturnValue(mockFirestoreWithError);

      // Should not throw even with Firestore error
      await expect(service.markAsRead('notif-1', 1)).resolves.not.toThrow();
    });
  });

  describe('markAllAsRead - Firestore error handling', () => {
    it('should continue if Firestore batch update fails', async () => {
      prismaService.notification.updateMany.mockResolvedValue({ count: 5 });

      // Make Firestore batch throw
      const mockFirestoreWithError = {
        collection: jest.fn().mockReturnThis(),
        doc: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockRejectedValue(new Error('Firestore error')),
        batch: jest.fn().mockReturnValue({
          update: jest.fn(),
          commit: jest.fn(),
        }),
      };
      firebaseService.getFirestore.mockReturnValue(mockFirestoreWithError);

      // Should not throw even with Firestore error
      await expect(service.markAllAsRead(1)).resolves.not.toThrow();
    });
  });

  describe('getNotifications - with post data', () => {
    it('should fetch post data for REPLY notifications in list', async () => {
      const mockNotifications = [
        {
          id: 'notif-1',
          type: NotificationType.REPLY,
          recipientId: 1,
          actorId: 2,
          actorUsername: 'replier',
          actorAvatarUrl: null,
          postId: null,
          quotePostId: null,
          replyId: 500,
          threadPostId: 400,
          isRead: false,
          createdAt: new Date(),
        },
      ];

      prismaService.notification.count.mockResolvedValueOnce(1);
      prismaService.notification.findMany.mockResolvedValue(mockNotifications as any);
      prismaService.$queryRaw = jest.fn().mockResolvedValue([{
        id: 500,
        user_id: 2,
        username: 'replier',
        isVerified: false,
        authorName: 'Replier User',
        authorProfileImage: null,
        likeCount: 1,
        replyCount: 0,
        repostCount: 0,
        isLikedByMe: false,
        isFollowedByMe: false,
        isRepostedByMe: false,
        content: 'Reply content',
        mediaUrls: [],
        type: 'REPLY',
        parent_id: 400,
        created_at: new Date(),
      }]);

      const result = await service.getNotifications(1, 1, 20, false);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].type).toBe(NotificationType.REPLY);
    });

    it('should fetch post data for QUOTE notifications in list', async () => {
      const mockNotifications = [
        {
          id: 'notif-1',
          type: NotificationType.QUOTE,
          recipientId: 1,
          actorId: 2,
          actorUsername: 'quoter',
          actorAvatarUrl: null,
          postId: null,
          quotePostId: 300,
          replyId: null,
          threadPostId: null,
          isRead: false,
          createdAt: new Date(),
        },
      ];

      prismaService.notification.count.mockResolvedValueOnce(1);
      prismaService.notification.findMany.mockResolvedValue(mockNotifications as any);
      prismaService.$queryRaw = jest.fn().mockResolvedValue([{
        id: 300,
        user_id: 2,
        username: 'quoter',
        isVerified: true,
        authorName: 'Quoter',
        authorProfileImage: null,
        likeCount: 5,
        replyCount: 1,
        repostCount: 2,
        isLikedByMe: true,
        isFollowedByMe: true,
        isRepostedByMe: false,
        content: 'Quote content',
        mediaUrls: [],
        type: 'QUOTE',
        parent_id: 200,
        created_at: new Date(),
      }]);

      const result = await service.getNotifications(1, 1, 20, false);

      expect(result.data).toHaveLength(1);
    });

    it('should handle post fetch returning empty array', async () => {
      const mockNotifications = [
        {
          id: 'notif-1',
          type: NotificationType.MENTION,
          recipientId: 1,
          actorId: 2,
          actorUsername: 'mentioner',
          actorAvatarUrl: null,
          postId: 999,
          quotePostId: null,
          replyId: null,
          threadPostId: null,
          isRead: false,
          createdAt: new Date(),
        },
      ];

      prismaService.notification.count.mockResolvedValueOnce(1);
      prismaService.notification.findMany.mockResolvedValue(mockNotifications as any);
      // Post not found
      prismaService.$queryRaw = jest.fn().mockResolvedValue([]);

      const result = await service.getNotifications(1, 1, 20, false);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].post).toBeUndefined();
    });

    it('should handle fetchPostDataForNotification error gracefully', async () => {
      const mockNotifications = [
        {
          id: 'notif-1',
          type: NotificationType.REPLY,
          recipientId: 1,
          actorId: 2,
          actorUsername: 'replier',
          actorAvatarUrl: null,
          postId: null,
          quotePostId: null,
          replyId: 500,
          threadPostId: 400,
          isRead: false,
          createdAt: new Date(),
        },
      ];

      prismaService.notification.count.mockResolvedValueOnce(1);
      prismaService.notification.findMany.mockResolvedValue(mockNotifications as any);
      // Post fetch throws error
      prismaService.$queryRaw = jest.fn().mockRejectedValue(new Error('Query error'));

      const result = await service.getNotifications(1, 1, 20, false);

      expect(result.data).toHaveLength(1);
      // Should still return notification without post data
      expect(result.data[0].post).toBeUndefined();
    });
  });

  describe('syncToFirestore - error handling', () => {
    it('should catch Firestore sync error without throwing', async () => {
      const mockNotification = {
        id: 'notif-123',
        type: NotificationType.LIKE,
        recipientId: 1,
        actorId: 2,
        actorUsername: 'user',
        actorAvatarUrl: null,
        postId: 100,
        quotePostId: null,
        replyId: null,
        threadPostId: null,
        postPreviewText: null,
        conversationId: null,
        messagePreview: null,
        isRead: false,
        createdAt: new Date(),
      };

      prismaService.notification.findFirst.mockResolvedValue(null);
      prismaService.notification.create.mockResolvedValue(mockNotification as any);

      // Make Firestore set throw
      const mockFirestoreWithError = {
        collection: jest.fn().mockReturnThis(),
        doc: jest.fn().mockReturnThis(),
        set: jest.fn().mockRejectedValue(new Error('Firestore error')),
      };
      firebaseService.getFirestore.mockReturnValue(mockFirestoreWithError);

      const dto = {
        type: NotificationType.LIKE,
        recipientId: 1,
        actorId: 2,
        actorUsername: 'user',
        postId: 100,
      };

      // Should not throw even with Firestore error
      const result = await service.createNotification(dto);
      expect(result).not.toBeNull();
    });
  });

  describe('buildUniqueWhereClause - branch coverage', () => {
    it('should properly check LIKE duplicate with postId', async () => {
      // First notification exists (duplicate)
      prismaService.notification.findFirst.mockResolvedValue({
        id: 'existing',
        type: NotificationType.LIKE,
        postId: 100,
      } as any);

      const dto = {
        type: NotificationType.LIKE,
        recipientId: 1,
        actorId: 2,
        actorUsername: 'user',
        postId: 100, // Has postId - triggers WHERE clause branch
      };

      const result = await service.createNotification(dto);

      expect(result).toBeNull(); // Duplicate found
      expect(prismaService.notification.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({
          type: NotificationType.LIKE,
          postId: 100,
        }),
      });
    });

    it('should properly check REPOST duplicate with postId', async () => {
      prismaService.notification.findFirst.mockResolvedValue({
        id: 'existing',
        type: NotificationType.REPOST,
        postId: 200,
      } as any);

      const dto = {
        type: NotificationType.REPOST,
        recipientId: 1,
        actorId: 2,
        actorUsername: 'user',
        postId: 200,
      };

      const result = await service.createNotification(dto);

      expect(result).toBeNull();
    });

    it('should properly check REPLY duplicate with replyId', async () => {
      prismaService.notification.findFirst.mockResolvedValue({
        id: 'existing',
        type: NotificationType.REPLY,
        replyId: 300,
      } as any);

      const dto = {
        type: NotificationType.REPLY,
        recipientId: 1,
        actorId: 2,
        actorUsername: 'user',
        replyId: 300,
      };

      const result = await service.createNotification(dto);

      expect(result).toBeNull();
    });

    it('should properly check MENTION duplicate with postId', async () => {
      prismaService.notification.findFirst.mockResolvedValue({
        id: 'existing',
        type: NotificationType.MENTION,
        postId: 400,
      } as any);

      const dto = {
        type: NotificationType.MENTION,
        recipientId: 1,
        actorId: 2,
        actorUsername: 'user',
        postId: 400,
      };

      const result = await service.createNotification(dto);

      expect(result).toBeNull();
    });

    it('should properly check QUOTE duplicate with quotePostId', async () => {
      prismaService.notification.findFirst.mockResolvedValue({
        id: 'existing',
        type: NotificationType.QUOTE,
        quotePostId: 500,
      } as any);

      const dto = {
        type: NotificationType.QUOTE,
        recipientId: 1,
        actorId: 2,
        actorUsername: 'user',
        quotePostId: 500,
      };

      const result = await service.createNotification(dto);

      expect(result).toBeNull();
    });
  });

  describe('handleFailedTokens - error codes', () => {
    it('should remove token with registration-token-not-registered error', async () => {
      const mockDeviceTokens = [{ token: 'token1', platform: 'IOS' }];
      prismaService.deviceToken.findMany.mockResolvedValue(mockDeviceTokens as any);

      mockMessaging.sendEachForMulticast.mockResolvedValue({
        successCount: 0,
        failureCount: 1,
        responses: [
          {
            success: false,
            error: { code: 'messaging/registration-token-not-registered' },
          },
        ],
      });
      prismaService.deviceToken.deleteMany.mockResolvedValue({ count: 1 });

      await service.sendPushNotification(1, 'Title', 'Body');

      expect(prismaService.deviceToken.deleteMany).toHaveBeenCalledWith({
        where: { token: { in: ['token1'] } },
      });
    });

    it('should not remove token with other error codes', async () => {
      const mockDeviceTokens = [{ token: 'token1', platform: 'IOS' }];
      prismaService.deviceToken.findMany.mockResolvedValue(mockDeviceTokens as any);

      mockMessaging.sendEachForMulticast.mockResolvedValue({
        successCount: 0,
        failureCount: 1,
        responses: [
          {
            success: false,
            error: { code: 'messaging/server-unavailable' },
          },
        ],
      });

      await service.sendPushNotification(1, 'Title', 'Body');

      // Should not call deleteMany for other error codes
      expect(prismaService.deviceToken.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('fetchPostDataForNotification - branches', () => {
    it('should handle post with null content', async () => {
      const mockNotifications = [
        {
          id: 'notif-1',
          type: NotificationType.REPLY,
          recipientId: 1,
          actorId: 2,
          actorUsername: 'replier',
          actorAvatarUrl: null,
          postId: null,
          quotePostId: null,
          replyId: 500,
          threadPostId: 400,
          isRead: false,
          createdAt: new Date(),
        },
      ];

      prismaService.notification.count.mockResolvedValueOnce(1);
      prismaService.notification.findMany.mockResolvedValue(mockNotifications as any);
      prismaService.$queryRaw = jest.fn().mockResolvedValue([{
        id: 500,
        user_id: 2,
        username: 'replier',
        isVerified: false,
        authorName: null, // Tests authorName || username fallback
        authorProfileImage: null,
        likeCount: 0,
        replyCount: 0,
        repostCount: 0,
        isLikedByMe: false,
        isFollowedByMe: false,
        isRepostedByMe: false,
        content: null, // Tests content || '' fallback
        mediaUrls: 'not-an-array', // Tests Array.isArray check
        type: 'REPLY',
        parent_id: 400,
        created_at: new Date(),
      }]);

      const result = await service.getNotifications(1, 1, 20, false);

      expect(result.data).toHaveLength(1);
    });

    it('should handle non-quote post type', async () => {
      const mockNotifications = [
        {
          id: 'notif-1',
          type: NotificationType.MENTION,
          recipientId: 1,
          actorId: 2,
          actorUsername: 'mentioner',
          actorAvatarUrl: null,
          postId: 600,
          quotePostId: null,
          replyId: null,
          threadPostId: null,
          isRead: false,
          createdAt: new Date(),
        },
      ];

      prismaService.notification.count.mockResolvedValueOnce(1);
      prismaService.notification.findMany.mockResolvedValue(mockNotifications as any);
      prismaService.$queryRaw = jest.fn().mockResolvedValue([{
        id: 600,
        user_id: 2,
        username: 'mentioner',
        isVerified: true,
        authorName: 'Display Name',
        authorProfileImage: 'https://example.com/avatar.jpg',
        likeCount: 5,
        replyCount: 2,
        repostCount: 3,
        isLikedByMe: true,
        isFollowedByMe: true,
        isRepostedByMe: true,
        content: 'Post content @user',
        mediaUrls: [{ url: 'https://example.com/image.jpg', type: 'image' }],
        type: 'POST', // Not a QUOTE
        parent_id: null, // No parent
        created_at: new Date(),
      }]);

      const result = await service.getNotifications(1, 1, 20, false);

      expect(result.data).toHaveLength(1);
    });
  });

  describe('truncateText - edge cases', () => {
    it('should handle null text', () => {
      expect(service.truncateText(null as any, 100)).toBe('');
    });

    it('should handle undefined text', () => {
      expect(service.truncateText(undefined as any, 100)).toBe('');
    });
  });

  describe('REPLY without replyId', () => {
    it('should handle REPLY without replyId (null whereClause)', async () => {
      const mockNotification = {
        id: 'notif-reply-no-id',
        type: NotificationType.REPLY,
        recipientId: 1,
        actorId: 2,
        actorUsername: 'replier',
        actorAvatarUrl: null,
        postId: null,
        quotePostId: null,
        replyId: null, // No replyId
        threadPostId: null,
        postPreviewText: null,
        conversationId: null,
        messagePreview: null,
        isRead: false,
        createdAt: new Date(),
      };

      prismaService.notification.findFirst.mockResolvedValue(null);
      prismaService.notification.create.mockResolvedValue(mockNotification as any);

      const dto = {
        type: NotificationType.REPLY,
        recipientId: 1,
        actorId: 2,
        actorUsername: 'replier',
        // No replyId - tests null whereClause branch
      };

      const result = await service.createNotification(dto);

      expect(result).not.toBeNull();
    });
  });

  describe('LIKE without postId', () => {
    it('should handle LIKE without postId (null whereClause)', async () => {
      const mockNotification = {
        id: 'notif-like-no-post',
        type: NotificationType.LIKE,
        recipientId: 1,
        actorId: 2,
        actorUsername: 'liker',
        actorAvatarUrl: null,
        postId: null,
        quotePostId: null,
        replyId: null,
        threadPostId: null,
        postPreviewText: null,
        conversationId: null,
        messagePreview: null,
        isRead: false,
        createdAt: new Date(),
      };

      // No findFirst call for null whereClause
      prismaService.notification.findFirst.mockResolvedValue(null);
      prismaService.notification.create.mockResolvedValue(mockNotification as any);

      const dto = {
        type: NotificationType.LIKE,
        recipientId: 1,
        actorId: 2,
        actorUsername: 'liker',
        // No postId - tests null whereClause branch for LIKE
      };

      const result = await service.createNotification(dto);

      expect(result).not.toBeNull();
    });
  });
});
