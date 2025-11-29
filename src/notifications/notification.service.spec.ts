import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from './notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseService } from '../firebase/firebase.service';
import { Services } from '../utils/constants';
import { NotificationType, Platform } from './enums/notification.enum';
import { NotFoundException } from '@nestjs/common';

describe('NotificationService', () => {
  let service: NotificationService;
  let prismaService: jest.Mocked<PrismaService>;
  let firebaseService: jest.Mocked<FirebaseService>;

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
        postId: 'post-456',
        quotePostId: null,
        replyId: null,
        threadPostId: null,
        postPreviewText: 'Great post!',
        conversationId: null,
        messagePreview: null,
        isRead: false,
        createdAt: new Date('2025-11-29T10:00:00Z'),
      };

      prismaService.notification.create.mockResolvedValue(mockNotification as any);

      const dto = {
        type: NotificationType.LIKE,
        recipientId: 1,
        actorId: 2,
        actorUsername: 'john_doe',
        actorAvatarUrl: 'https://example.com/avatar.jpg',
        postId: 'post-456',
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
        actor: {
          id: 2,
          username: 'john_doe',
          avatarUrl: 'https://example.com/avatar.jpg',
        },
        postId: 'post-456',
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

      prismaService.notification.create.mockResolvedValue(mockNotification as any);

      const dto = {
        type: NotificationType.FOLLOW,
        recipientId: 1,
        actorId: 3,
        actorUsername: 'jane_smith',
      };

      const result = await service.createNotification(dto);

      expect(result.type).toBe(NotificationType.FOLLOW);
      expect(result.postId).toBeUndefined();
      expect(result.actor.username).toBe('jane_smith');
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
        conversationId: 'conv-123',
        messagePreview: 'Hey, how are you?',
        isRead: false,
        createdAt: new Date('2025-11-29T12:00:00Z'),
      };

      prismaService.notification.create.mockResolvedValue(mockNotification as any);

      const dto = {
        type: NotificationType.DM,
        recipientId: 1,
        actorId: 4,
        actorUsername: 'bob_wilson',
        actorAvatarUrl: 'https://example.com/bob.jpg',
        conversationId: 'conv-123',
        messagePreview: 'Hey, how are you?',
      };

      const result = await service.createNotification(dto);

      expect(result.type).toBe(NotificationType.DM);
      expect(result.conversationId).toBe('conv-123');
      expect(result.messagePreview).toBe('Hey, how are you?');
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
      expect(result.metadata.unreadCount).toBe(5);
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
  });

  describe('markAsRead', () => {
    it('should mark a notification as read in Prisma and Firestore', async () => {
      const mockNotification = {
        id: 'notif-123',
        recipientId: 1,
        isRead: false,
      };

      prismaService.notification.findFirst.mockResolvedValue(mockNotification as any);
      prismaService.notification.update.mockResolvedValue({ ...mockNotification, isRead: true } as any);

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
      const mockUnreadDocs = [
        { ref: { id: 'notif-1' } },
        { ref: { id: 'notif-2' } },
      ];

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
      expect(result).toEndWith('...');
    });

    it('should handle empty text', () => {
      expect(service.truncateText('', 100)).toBe('');
    });
  });
});
