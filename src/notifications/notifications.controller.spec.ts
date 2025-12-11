import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationService } from './notification.service';
import { Services } from '../utils/constants';
import { Platform } from './enums/notification.enum';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let notificationService: jest.Mocked<NotificationService>;

  const mockNotificationService = {
    getNotifications: jest.fn(),
    getUnreadCount: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    registerDevice: jest.fn(),
    removeDevice: jest.fn(),
  };

  const mockUser = { id: 1, username: 'testuser' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        {
          provide: Services.NOTIFICATION,
          useValue: mockNotificationService,
        },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
    notificationService = module.get(Services.NOTIFICATION);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getNotifications', () => {
    const mockNotificationsResponse = {
      data: [
        {
          id: 'notif-1',
          type: 'LIKE',
          recipientId: 1,
          actor: { id: 2, username: 'john_doe', avatarUrl: null },
          postId: 100,
          isRead: false,
          createdAt: '2025-12-11T10:00:00.000Z',
        },
      ],
      metadata: {
        totalItems: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      },
    };

    it('should return paginated notifications', async () => {
      mockNotificationService.getNotifications.mockResolvedValue(mockNotificationsResponse);

      const query = { page: 1, limit: 20 };
      const result = await controller.getNotifications(mockUser.id, query);

      expect(result).toEqual(mockNotificationsResponse);
      expect(notificationService.getNotifications).toHaveBeenCalledWith(
        1,
        1,
        20,
        undefined,
        undefined,
        undefined,
      );
    });

    it('should filter by unreadOnly', async () => {
      mockNotificationService.getNotifications.mockResolvedValue(mockNotificationsResponse);

      const query = { page: 1, limit: 20, unreadOnly: true };
      const result = await controller.getNotifications(mockUser.id, query);

      expect(result).toEqual(mockNotificationsResponse);
      expect(notificationService.getNotifications).toHaveBeenCalledWith(
        1,
        1,
        20,
        true,
        undefined,
        undefined,
      );
    });

    it('should filter by include types', async () => {
      mockNotificationService.getNotifications.mockResolvedValue(mockNotificationsResponse);

      const query = { page: 1, limit: 20, include: 'LIKE,FOLLOW' };
      const result = await controller.getNotifications(mockUser.id, query);

      expect(result).toEqual(mockNotificationsResponse);
      expect(notificationService.getNotifications).toHaveBeenCalledWith(
        1,
        1,
        20,
        undefined,
        'LIKE,FOLLOW',
        undefined,
      );
    });

    it('should filter by exclude types', async () => {
      mockNotificationService.getNotifications.mockResolvedValue(mockNotificationsResponse);

      const query = { page: 1, limit: 20, exclude: 'DM' };
      const result = await controller.getNotifications(mockUser.id, query);

      expect(result).toEqual(mockNotificationsResponse);
      expect(notificationService.getNotifications).toHaveBeenCalledWith(
        1,
        1,
        20,
        undefined,
        undefined,
        'DM',
      );
    });

    it('should handle custom pagination', async () => {
      mockNotificationService.getNotifications.mockResolvedValue({
        ...mockNotificationsResponse,
        metadata: { ...mockNotificationsResponse.metadata, page: 2, limit: 50 },
      });

      const query = { page: 2, limit: 50 };
      const result = await controller.getNotifications(mockUser.id, query);

      expect(notificationService.getNotifications).toHaveBeenCalledWith(
        1,
        2,
        50,
        undefined,
        undefined,
        undefined,
      );
      expect(result.metadata.page).toBe(2);
      expect(result.metadata.limit).toBe(50);
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count', async () => {
      mockNotificationService.getUnreadCount.mockResolvedValue(5);

      const result = await controller.getUnreadCount(mockUser.id);

      expect(result).toEqual({ unreadCount: 5 });
      expect(notificationService.getUnreadCount).toHaveBeenCalledWith(
        1,
        undefined,
        undefined,
      );
    });

    it('should return unread count with include filter', async () => {
      mockNotificationService.getUnreadCount.mockResolvedValue(3);

      const result = await controller.getUnreadCount(mockUser.id, 'LIKE,COMMENT');

      expect(result).toEqual({ unreadCount: 3 });
      expect(notificationService.getUnreadCount).toHaveBeenCalledWith(
        1,
        'LIKE,COMMENT',
        undefined,
      );
    });

    it('should return unread count with exclude filter', async () => {
      mockNotificationService.getUnreadCount.mockResolvedValue(10);

      const result = await controller.getUnreadCount(mockUser.id, undefined, 'DM');

      expect(result).toEqual({ unreadCount: 10 });
      expect(notificationService.getUnreadCount).toHaveBeenCalledWith(
        1,
        undefined,
        'DM',
      );
    });

    it('should return zero when no unread notifications', async () => {
      mockNotificationService.getUnreadCount.mockResolvedValue(0);

      const result = await controller.getUnreadCount(mockUser.id);

      expect(result).toEqual({ unreadCount: 0 });
    });
  });

  describe('markAsRead', () => {
    it('should mark a notification as read', async () => {
      mockNotificationService.markAsRead.mockResolvedValue(undefined);

      const result = await controller.markAsRead(mockUser.id, 'notif-123');

      expect(result).toEqual({ message: 'Notification marked as read' });
      expect(notificationService.markAsRead).toHaveBeenCalledWith('notif-123', 1);
    });

    it('should call markAsRead with correct parameters', async () => {
      mockNotificationService.markAsRead.mockResolvedValue(undefined);

      await controller.markAsRead(mockUser.id, 'notif-abc-xyz');

      expect(notificationService.markAsRead).toHaveBeenCalledWith('notif-abc-xyz', mockUser.id);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      mockNotificationService.markAllAsRead.mockResolvedValue(undefined);

      const result = await controller.markAllAsRead(mockUser.id);

      expect(result).toEqual({ message: 'All notifications marked as read' });
      expect(notificationService.markAllAsRead).toHaveBeenCalledWith(1);
    });
  });

  describe('registerDevice', () => {
    it('should register a device token for IOS', async () => {
      mockNotificationService.registerDevice.mockResolvedValue(undefined);

      const dto = { token: 'fcm-token-123', platform: Platform.IOS };
      const result = await controller.registerDevice(mockUser.id, dto);

      expect(result).toEqual({ message: 'Device registered successfully' });
      expect(notificationService.registerDevice).toHaveBeenCalledWith(
        1,
        'fcm-token-123',
        Platform.IOS,
      );
    });

    it('should register a device token for Android', async () => {
      mockNotificationService.registerDevice.mockResolvedValue(undefined);

      const dto = { token: 'android-fcm-token', platform: Platform.ANDROID };
      const result = await controller.registerDevice(mockUser.id, dto);

      expect(result).toEqual({ message: 'Device registered successfully' });
      expect(notificationService.registerDevice).toHaveBeenCalledWith(
        1,
        'android-fcm-token',
        Platform.ANDROID,
      );
    });

    it('should register a device token for Web', async () => {
      mockNotificationService.registerDevice.mockResolvedValue(undefined);

      const dto = { token: 'web-push-token', platform: Platform.WEB };
      const result = await controller.registerDevice(mockUser.id, dto);

      expect(result).toEqual({ message: 'Device registered successfully' });
      expect(notificationService.registerDevice).toHaveBeenCalledWith(
        1,
        'web-push-token',
        Platform.WEB,
      );
    });
  });

  describe('removeDevice', () => {
    it('should remove a device token', async () => {
      mockNotificationService.removeDevice.mockResolvedValue(undefined);

      const result = await controller.removeDevice('token-to-remove');

      expect(result).toEqual({ message: 'Device removed successfully' });
      expect(notificationService.removeDevice).toHaveBeenCalledWith('token-to-remove');
    });

    it('should handle removal of non-existent token gracefully', async () => {
      mockNotificationService.removeDevice.mockResolvedValue(undefined);

      const result = await controller.removeDevice('non-existent-token');

      expect(result).toEqual({ message: 'Device removed successfully' });
      expect(notificationService.removeDevice).toHaveBeenCalledWith('non-existent-token');
    });
  });
});
