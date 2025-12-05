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
            truncateText: jest.fn((text) => text?.substring(0, 100) + '...'),
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

  describe('handleNotificationCreate - LIKE', () => {
    it('should create LIKE notification and send push', async () => {
      const mockActor = {
        id: 2,
        username: 'john_doe',
        avatar_url: 'https://example.com/avatar.jpg',
      };

      const mockPost = {
        id: 100,
        content: 'This is my post content that I wrote today',
        user_id: 1,
      };

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockActor);
      (prismaService.post.findUnique as jest.Mock).mockResolvedValue(mockPost);
      (notificationService.createNotification as jest.Mock).mockResolvedValue({
        id: 'notif-123',
      });

      const event = {
        type: NotificationType.LIKE,
        recipientId: 1,
        actorId: 2,
        postId: 100,
      };

      await listener.handleNotificationCreate(event);

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 2 },
        select: { id: true, username: true, avatar_url: true },
      });

      expect(prismaService.post.findUnique).toHaveBeenCalledWith({
        where: { id: 100 },
        select: { id: true, content: true, user_id: true },
      });

      expect(notificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: NotificationType.LIKE,
          recipientId: 1,
          actorId: 2,
          actorUsername: 'john_doe',
          actorAvatarUrl: 'https://example.com/avatar.jpg',
          postId: 100,
          postPreviewText: expect.any(String),
        }),
      );

      expect(notificationService.sendPushNotification).toHaveBeenCalledWith(
        1,
        'New Like',
        '@john_doe liked your post',
        expect.any(Object),
      );
    });
  });

  describe('handleNotificationCreate - REPOST', () => {
    it('should create REPOST notification', async () => {
      const mockActor = {
        id: 3,
        username: 'jane_smith',
        avatar_url: null,
      };

      const mockPost = {
        id: 200,
        content: 'Original post',
        user_id: 1,
      };

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockActor);
      (prismaService.post.findUnique as jest.Mock).mockResolvedValue(mockPost);
      (notificationService.createNotification as jest.Mock).mockResolvedValue({
        id: 'notif-456',
      });

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
        '@jane_smith reposted your post',
        expect.any(Object),
      );
    });
  });

  describe('handleNotificationCreate - QUOTE', () => {
    it('should create QUOTE notification with quotePostId', async () => {
      const mockActor = {
        id: 4,
        username: 'bob_wilson',
        avatar_url: 'https://example.com/bob.jpg',
      };

      const mockOriginalPost = {
        id: 300,
        content: 'Original post to quote',
        user_id: 1,
      };

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockActor);
      (prismaService.post.findUnique as jest.Mock).mockResolvedValue(mockOriginalPost);
      (notificationService.createNotification as jest.Mock).mockResolvedValue({
        id: 'notif-quote-1',
      });

      const event = {
        type: NotificationType.QUOTE,
        recipientId: 1,
        actorId: 4,
        postId: 400, // New quote post
        quotePostId: 300, // Original post being quoted
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
        '@bob_wilson quoted your post',
        expect.any(Object),
      );
    });
  });

  describe('handleNotificationCreate - REPLY', () => {
    it('should create REPLY notification with threadPostId', async () => {
      const mockActor = {
        id: 5,
        username: 'alice_jones',
        avatar_url: null,
      };

      const mockOriginalPost = {
        id: 500,
        content: 'Original post',
        user_id: 1,
      };

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockActor);
      (prismaService.post.findUnique as jest.Mock).mockResolvedValue(mockOriginalPost);
      (notificationService.createNotification as jest.Mock).mockResolvedValue({
        id: 'notif-reply-1',
      });

      const event = {
        type: NotificationType.REPLY,
        recipientId: 1,
        actorId: 5,
        replyId: 600, // Reply post
        threadPostId: 500, // Original thread post
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
        '@alice_jones replied to your post',
        expect.any(Object),
      );
    });
  });

  describe('handleNotificationCreate - MENTION', () => {
    it('should create MENTION notification', async () => {
      const mockActor = {
        id: 6,
        username: 'charlie_brown',
        avatar_url: 'https://example.com/charlie.jpg',
      };

      const mockPost = {
        id: 700,
        content: '@testuser check this out!',
        user_id: 6,
      };

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockActor);
      (prismaService.post.findUnique as jest.Mock).mockResolvedValue(mockPost);
      (notificationService.createNotification as jest.Mock).mockResolvedValue({
        id: 'notif-mention-1',
      });

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
        '@charlie_brown mentioned you in a post',
        expect.any(Object),
      );
    });
  });

  describe('handleNotificationCreate - FOLLOW', () => {
    it('should create FOLLOW notification without post data', async () => {
      const mockActor = {
        id: 7,
        username: 'diana_prince',
        avatar_url: 'https://example.com/diana.jpg',
      };

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockActor);
      (notificationService.createNotification as jest.Mock).mockResolvedValue({
        id: 'notif-follow-1',
      });

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
        }),
      );

      expect(notificationService.sendPushNotification).toHaveBeenCalledWith(
        1,
        'New Follower',
        '@diana_prince started following you',
        expect.any(Object),
      );
    });
  });

  describe('handleNotificationCreate - DM', () => {
    it('should create DM notification with conversation data', async () => {
      const mockActor = {
        id: 8,
        username: 'eve_adams',
        avatar_url: null,
      };

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockActor);
      (notificationService.createNotification as jest.Mock).mockResolvedValue({
        id: 'notif-dm-1',
      });

      const event = {
        type: NotificationType.DM,
        recipientId: 1,
        actorId: 8,
        conversationId: 999,
        messagePreview: 'Hey! How are you doing?',
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
        'New Message',
        '@eve_adams: Hey! How are you doing?',
        expect.any(Object),
      );
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

    it('should handle missing post gracefully', async () => {
      const mockActor = {
        id: 2,
        username: 'john_doe',
        avatar_url: null,
      };

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockActor);
      (prismaService.post.findUnique as jest.Mock).mockResolvedValue(null);

      const event = {
        type: NotificationType.LIKE,
        recipientId: 1,
        actorId: 2,
        postId: 999,
      };

      await expect(listener.handleNotificationCreate(event)).resolves.not.toThrow();
      expect(notificationService.createNotification).not.toHaveBeenCalled();
    });

    it('should continue even if notification creation fails', async () => {
      const mockActor = {
        id: 2,
        username: 'john_doe',
        avatar_url: null,
      };

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
  });
});
