import { Test, TestingModule } from '@nestjs/testing';
import { NotificationListener } from './notification.listener';
import { NotificationService } from '../notification.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Services } from '../../utils/constants';
import { NotificationType } from '../enums/notification.enum';

describe('NotificationListener', () => {
  let listener: NotificationListener;
  let notificationService: jest.Mocked<NotificationService>;
  let prismaService: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationListener,
        {
          provide: Services.NOTIFICATION,
          useValue: {
            createNotification: jest.fn(),
            sendPushNotification: jest.fn(),
            truncateText: jest.fn((text, maxLength = 100) => {
              if (!text) return '';
              if (text.length <= maxLength) return text;
              return text.substring(0, maxLength) + '...';
            }),
          },
        },
        {
          provide: Services.PRISMA,
          useValue: {
            user: {
              findUnique: jest.fn(),
            },
            post: {
              findUnique: jest.fn(),
            },
            mute: {
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    listener = module.get<NotificationListener>(NotificationListener);
    notificationService = module.get(Services.NOTIFICATION);
    prismaService = module.get(Services.PRISMA);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Helper to create mock actor with Profile relation (matches current implementation)
  const createMockActor = (overrides = {}) => ({
    username: 'john_doe',
    Profile: {
      name: 'John Doe',
      profile_image_url: 'https://example.com/avatar.jpg',
    },
    ...overrides,
  });

  // Helper to create mock notification response
  const createMockNotification = (overrides = {}) => ({
    id: 'notif-123',
    type: NotificationType.LIKE,
    recipientId: 1,
    isRead: false,
    createdAt: '2025-12-11T10:00:00.000Z',
    actor: {
      id: 2,
      username: 'john_doe',
      displayName: 'John Doe',
      avatarUrl: 'https://example.com/avatar.jpg',
    },
    ...overrides,
  });

  describe('handleNotificationCreate - LIKE', () => {
    it('should create LIKE notification and send push', async () => {
      const mockActor = createMockActor();
      const mockPost = { content: 'This is my post content' };
      const mockNotification = createMockNotification({ postId: 100 });

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockActor);
      (prismaService.post.findUnique as jest.Mock).mockResolvedValue(mockPost);
      (notificationService.createNotification as jest.Mock).mockResolvedValue(mockNotification);

      const event = {
        type: NotificationType.LIKE,
        recipientId: 1,
        actorId: 2,
        postId: 100,
      };

      await listener.handleNotificationCreate(event);

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 2 },
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

      expect(prismaService.post.findUnique).toHaveBeenCalledWith({
        where: { id: 100 },
        select: { content: true },
      });

      expect(notificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: NotificationType.LIKE,
          recipientId: 1,
          actorId: 2,
          actorUsername: 'john_doe',
          actorDisplayName: 'John Doe',
          actorAvatarUrl: 'https://example.com/avatar.jpg',
          postId: 100,
        }),
      );

      expect(notificationService.sendPushNotification).toHaveBeenCalledWith(
        1,
        'New Like',
        expect.stringContaining('John Doe liked your post'),
        expect.any(Object),
      );
    });

    it('should use username when no Profile name exists', async () => {
      const mockActor = createMockActor({ Profile: null });
      const mockPost = { content: 'Post content' };
      const mockNotification = createMockNotification();

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockActor);
      (prismaService.post.findUnique as jest.Mock).mockResolvedValue(mockPost);
      (notificationService.createNotification as jest.Mock).mockResolvedValue(mockNotification);

      const event = {
        type: NotificationType.LIKE,
        recipientId: 1,
        actorId: 2,
        postId: 100,
      };

      await listener.handleNotificationCreate(event);

      expect(notificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          actorDisplayName: null,
          actorAvatarUrl: null,
        }),
      );

      expect(notificationService.sendPushNotification).toHaveBeenCalledWith(
        1,
        'New Like',
        expect.stringContaining('john_doe liked your post'),
        expect.any(Object),
      );
    });
  });

  describe('handleNotificationCreate - REPOST', () => {
    it('should create REPOST notification', async () => {
      const mockActor = createMockActor({ username: 'jane_smith', Profile: { name: 'Jane Smith' } });
      const mockPost = { content: 'Original post' };
      const mockNotification = createMockNotification({ type: NotificationType.REPOST });

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockActor);
      (prismaService.post.findUnique as jest.Mock).mockResolvedValue(mockPost);
      (notificationService.createNotification as jest.Mock).mockResolvedValue(mockNotification);

      const event = {
        type: NotificationType.REPOST,
        recipientId: 1,
        actorId: 3,
        postId: 200,
      };

      await listener.handleNotificationCreate(event);

      expect(notificationService.sendPushNotification).toHaveBeenCalledWith(
        1,
        'New Repost',
        expect.stringContaining('Jane Smith reposted your post'),
        expect.any(Object),
      );
    });
  });

  describe('handleNotificationCreate - QUOTE', () => {
    it('should create QUOTE notification with quotePostId', async () => {
      const mockActor = createMockActor({ username: 'bob_wilson', Profile: { name: 'Bob Wilson' } });
      const mockPost = { content: 'Original post to quote' };
      const mockNotification = createMockNotification({
        type: NotificationType.QUOTE,
        postId: 400,
        quotePostId: 300,
      });

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockActor);
      (prismaService.post.findUnique as jest.Mock).mockResolvedValue(mockPost);
      (notificationService.createNotification as jest.Mock).mockResolvedValue(mockNotification);

      const event = {
        type: NotificationType.QUOTE,
        recipientId: 1,
        actorId: 4,
        postId: 400,
        quotePostId: 300,
      };

      await listener.handleNotificationCreate(event);

      expect(notificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: NotificationType.QUOTE,
          postId: 400,
          quotePostId: 300,
        }),
      );

      expect(notificationService.sendPushNotification).toHaveBeenCalledWith(
        1,
        'New Quote',
        expect.stringContaining('Bob Wilson quoted your post'),
        expect.any(Object),
      );
    });
  });

  describe('handleNotificationCreate - REPLY', () => {
    it('should create REPLY notification with threadPostId', async () => {
      const mockActor = createMockActor({ username: 'alice_jones', Profile: { name: 'Alice Jones' } });
      const mockNotification = createMockNotification({
        type: NotificationType.REPLY,
        replyId: 600,
        threadPostId: 500,
      });

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockActor);
      (notificationService.createNotification as jest.Mock).mockResolvedValue(mockNotification);

      const event = {
        type: NotificationType.REPLY,
        recipientId: 1,
        actorId: 5,
        replyId: 600,
        threadPostId: 500,
      };

      await listener.handleNotificationCreate(event);

      expect(notificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: NotificationType.REPLY,
          replyId: 600,
          threadPostId: 500,
        }),
      );

      expect(notificationService.sendPushNotification).toHaveBeenCalledWith(
        1,
        'New Reply',
        expect.stringContaining('Alice Jones replied to your post'),
        expect.any(Object),
      );
    });
  });

  describe('handleNotificationCreate - MENTION', () => {
    it('should create MENTION notification', async () => {
      const mockActor = createMockActor({ username: 'charlie_brown', Profile: { name: 'Charlie Brown' } });
      const mockPost = { content: '@testuser check this out!' };
      const mockNotification = createMockNotification({
        type: NotificationType.MENTION,
        postId: 700,
      });

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockActor);
      (prismaService.post.findUnique as jest.Mock).mockResolvedValue(mockPost);
      (notificationService.createNotification as jest.Mock).mockResolvedValue(mockNotification);

      const event = {
        type: NotificationType.MENTION,
        recipientId: 1,
        actorId: 6,
        postId: 700,
      };

      await listener.handleNotificationCreate(event);

      expect(notificationService.sendPushNotification).toHaveBeenCalledWith(
        1,
        'New Mention',
        expect.stringContaining('Charlie Brown mentioned you in a post'),
        expect.any(Object),
      );
    });
  });

  describe('handleNotificationCreate - FOLLOW', () => {
    it('should create FOLLOW notification without post data', async () => {
      const mockActor = createMockActor({ username: 'diana_prince', Profile: { name: 'Diana Prince' } });
      const mockNotification = createMockNotification({ type: NotificationType.FOLLOW });

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockActor);
      (notificationService.createNotification as jest.Mock).mockResolvedValue(mockNotification);

      const event = {
        type: NotificationType.FOLLOW,
        recipientId: 1,
        actorId: 7,
      };

      await listener.handleNotificationCreate(event);

      expect(prismaService.post.findUnique).not.toHaveBeenCalled();

      expect(notificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: NotificationType.FOLLOW,
          recipientId: 1,
          actorId: 7,
          actorUsername: 'diana_prince',
          actorDisplayName: 'Diana Prince',
        }),
      );

      expect(notificationService.sendPushNotification).toHaveBeenCalledWith(
        1,
        'New Follower',
        'Diana Prince started following you',
        expect.any(Object),
      );
    });
  });

  describe('handleNotificationCreate - DM', () => {
    it('should create DM notification with conversation data', async () => {
      const mockActor = createMockActor({ username: 'eve_adams', Profile: { name: 'Eve Adams' } });
      const mockNotification = createMockNotification({
        type: NotificationType.DM,
        conversationId: 999,
        messagePreview: 'Hey! How are you doing?',
      });

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockActor);
      (notificationService.createNotification as jest.Mock).mockResolvedValue(mockNotification);

      const event = {
        type: NotificationType.DM,
        recipientId: 1,
        actorId: 8,
        conversationId: 999,
        messageText: 'Hey! How are you doing?',
      };

      await listener.handleNotificationCreate(event);

      expect(notificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: NotificationType.DM,
          conversationId: 999,
          messagePreview: 'Hey! How are you doing?',
        }),
      );

      expect(notificationService.sendPushNotification).toHaveBeenCalledWith(
        1,
        'Message from Eve Adams',
        'Hey! How are you doing?',
        expect.any(Object),
      );
    });

    it('should show "New message" when no messagePreview available', async () => {
      const mockActor = createMockActor({ username: 'eve_adams', Profile: { name: 'Eve Adams' } });
      const mockNotification = createMockNotification({
        type: NotificationType.DM,
        conversationId: 999,
      });

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockActor);
      (notificationService.createNotification as jest.Mock).mockResolvedValue(mockNotification);

      const event = {
        type: NotificationType.DM,
        recipientId: 1,
        actorId: 8,
        conversationId: 999,
      };

      await listener.handleNotificationCreate(event);

      expect(notificationService.sendPushNotification).toHaveBeenCalledWith(
        1,
        'Message from Eve Adams',
        'New message',
        expect.any(Object),
      );
    });
  });

  describe('Duplicate notification handling', () => {
    it('should skip push notification when createNotification returns null (duplicate)', async () => {
      const mockActor = createMockActor();

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockActor);
      (notificationService.createNotification as jest.Mock).mockResolvedValue(null);

      const event = {
        type: NotificationType.LIKE,
        recipientId: 1,
        actorId: 2,
        postId: 100,
      };

      await listener.handleNotificationCreate(event);

      expect(notificationService.sendPushNotification).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing actor gracefully', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      const event = {
        type: NotificationType.LIKE,
        recipientId: 1,
        actorId: 999,
        postId: 100,
      };

      await expect(listener.handleNotificationCreate(event)).resolves.not.toThrow();
      expect(notificationService.createNotification).not.toHaveBeenCalled();
    });

    it('should continue without post preview text when post not found', async () => {
      const mockActor = createMockActor();
      const mockNotification = createMockNotification();

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockActor);
      (prismaService.post.findUnique as jest.Mock).mockResolvedValue(null);
      (notificationService.createNotification as jest.Mock).mockResolvedValue(mockNotification);

      const event = {
        type: NotificationType.LIKE,
        recipientId: 1,
        actorId: 2,
        postId: 999,
      };

      await expect(listener.handleNotificationCreate(event)).resolves.not.toThrow();
      expect(notificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          postPreviewText: undefined,
        }),
      );
    });

    it('should continue even if notification creation fails', async () => {
      const mockActor = createMockActor();

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockActor);
      (notificationService.createNotification as jest.Mock).mockRejectedValue(
        new Error('Database error'),
      );

      const event = {
        type: NotificationType.FOLLOW,
        recipientId: 1,
        actorId: 2,
      };

      await expect(listener.handleNotificationCreate(event)).resolves.not.toThrow();
    });

    it('should handle post with empty content', async () => {
      const mockActor = createMockActor();
      const mockPost = { content: '' };
      const mockNotification = createMockNotification();

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockActor);
      (prismaService.post.findUnique as jest.Mock).mockResolvedValue(mockPost);
      (notificationService.createNotification as jest.Mock).mockResolvedValue(mockNotification);

      const event = {
        type: NotificationType.LIKE,
        recipientId: 1,
        actorId: 2,
        postId: 100,
      };

      await listener.handleNotificationCreate(event);

      expect(notificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          postPreviewText: undefined,
        }),
      );
    });
  });

  describe('FCM data payload', () => {
    it('should build correct FCM data payload with all fields', async () => {
      const mockActor = createMockActor();
      const mockPost = { content: 'Test post' };
      const mockNotification = {
        id: 'notif-123',
        type: NotificationType.LIKE,
        recipientId: 1,
        isRead: false,
        createdAt: '2025-12-11T10:00:00.000Z',
        actor: { id: 2, username: 'john_doe' },
        postId: 100,
        postPreviewText: 'Test post',
      };

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockActor);
      (prismaService.post.findUnique as jest.Mock).mockResolvedValue(mockPost);
      (notificationService.createNotification as jest.Mock).mockResolvedValue(mockNotification);

      const event = {
        type: NotificationType.LIKE,
        recipientId: 1,
        actorId: 2,
        postId: 100,
      };

      await listener.handleNotificationCreate(event);

      expect(notificationService.sendPushNotification).toHaveBeenCalledWith(
        1,
        'New Like',
        expect.any(String),
        expect.objectContaining({
          id: 'notif-123',
          type: NotificationType.LIKE,
          recipientId: '1',
          isRead: 'false',
          postId: '100',
        }),
      );
    });

    it('should include post data in FCM payload when available', async () => {
      const mockActor = createMockActor();
      const mockPost = { content: 'Test post with embedded data' };
      const mockNotification = {
        id: 'notif-123',
        type: NotificationType.REPLY,
        recipientId: 1,
        isRead: false,
        createdAt: '2025-12-11T10:00:00.000Z',
        actor: { id: 2, username: 'john_doe' },
        replyId: 600,
        threadPostId: 500,
        post: {
          userId: 2,
          username: 'john_doe',
          postId: 600,
          text: 'Reply content',
        },
      };

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockActor);
      (prismaService.post.findUnique as jest.Mock).mockResolvedValue(mockPost);
      (notificationService.createNotification as jest.Mock).mockResolvedValue(mockNotification);

      const event = {
        type: NotificationType.REPLY,
        recipientId: 1,
        actorId: 2,
        replyId: 600,
        threadPostId: 500,
      };

      await listener.handleNotificationCreate(event);

      expect(notificationService.sendPushNotification).toHaveBeenCalledWith(
        1,
        'New Reply',
        expect.any(String),
        expect.objectContaining({
          post: expect.any(String), // Stringified post data
        }),
      );
    });
  });

  describe('Push notification message variations', () => {
    it('should handle REPOST without postPreview', async () => {
      const mockActor = createMockActor({ username: 'reposter', Profile: { name: 'Reposter' } });
      const mockNotification = createMockNotification({ type: NotificationType.REPOST });

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockActor);
      (notificationService.createNotification as jest.Mock).mockResolvedValue(mockNotification);

      const event = {
        type: NotificationType.REPOST,
        recipientId: 1,
        actorId: 3,
        // No postId - no post preview
      };

      await listener.handleNotificationCreate(event);

      expect(notificationService.sendPushNotification).toHaveBeenCalledWith(
        1,
        'New Repost',
        'Reposter reposted your post',
        expect.any(Object),
      );
    });

    it('should handle QUOTE without postPreview', async () => {
      const mockActor = createMockActor({ username: 'quoter', Profile: { name: 'Quoter' } });
      const mockNotification = createMockNotification({ type: NotificationType.QUOTE, quotePostId: 300 });

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockActor);
      (notificationService.createNotification as jest.Mock).mockResolvedValue(mockNotification);

      const event = {
        type: NotificationType.QUOTE,
        recipientId: 1,
        actorId: 4,
        quotePostId: 300,
        // No postId - no post preview
      };

      await listener.handleNotificationCreate(event);

      expect(notificationService.sendPushNotification).toHaveBeenCalledWith(
        1,
        'New Quote',
        'Quoter quoted your post',
        expect.any(Object),
      );
    });

    it('should handle REPLY with postPreview', async () => {
      const mockActor = createMockActor({ username: 'replier', Profile: { name: 'Replier' } });
      const mockPost = { content: 'This is a reply with preview text' };
      const mockNotification = createMockNotification({
        type: NotificationType.REPLY,
        replyId: 600,
        threadPostId: 500,
      });

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockActor);
      (prismaService.post.findUnique as jest.Mock).mockResolvedValue(mockPost);
      (notificationService.createNotification as jest.Mock).mockResolvedValue(mockNotification);

      const event = {
        type: NotificationType.REPLY,
        recipientId: 1,
        actorId: 5,
        postId: 600, // This triggers post preview
        replyId: 600,
        threadPostId: 500,
      };

      await listener.handleNotificationCreate(event);

      expect(notificationService.sendPushNotification).toHaveBeenCalledWith(
        1,
        'New Reply',
        expect.stringContaining('Replier replied to your post'),
        expect.any(Object),
      );
    });

    it('should handle MENTION without postPreview', async () => {
      const mockActor = createMockActor({ username: 'mentioner', Profile: { name: 'Mentioner' } });
      const mockNotification = createMockNotification({ type: NotificationType.MENTION });

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockActor);
      (notificationService.createNotification as jest.Mock).mockResolvedValue(mockNotification);

      const event = {
        type: NotificationType.MENTION,
        recipientId: 1,
        actorId: 6,
        // No postId - no post preview
      };

      await listener.handleNotificationCreate(event);

      expect(notificationService.sendPushNotification).toHaveBeenCalledWith(
        1,
        'New Mention',
        'Mentioner mentioned you in a post',
        expect.any(Object),
      );
    });

    it('should handle unknown notification type with default message', async () => {
      const mockActor = createMockActor({ username: 'unknown_user', Profile: { name: 'Unknown User' } });
      const mockNotification = createMockNotification({ type: 'UNKNOWN_TYPE' as NotificationType });

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockActor);
      (notificationService.createNotification as jest.Mock).mockResolvedValue(mockNotification);

      const event = {
        type: 'UNKNOWN_TYPE' as NotificationType,
        recipientId: 1,
        actorId: 7,
      };

      await listener.handleNotificationCreate(event);

      expect(notificationService.sendPushNotification).toHaveBeenCalledWith(
        1,
        'New Notification',
        'Unknown User interacted with you',
        expect.any(Object),
      );
    });
  });
});
