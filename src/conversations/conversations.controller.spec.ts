import { Test, TestingModule } from '@nestjs/testing';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { Services } from 'src/utils/constants';

describe('ConversationsController', () => {
  let controller: ConversationsController;
  let conversationsService: ConversationsService;

  const mockConversationsService = {
    create: jest.fn(),
    getConversationsForUser: jest.fn(),
    getUnseenConversationsCount: jest.fn(),
  };

  const mockUser = {
    id: 1,
    email: 'test@example.com',
    username: 'testuser',
    role: 'USER',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConversationsController],
      providers: [
        {
          provide: Services.CONVERSATIONS,
          useValue: mockConversationsService,
        },
      ],
    }).compile();

    controller = module.get<ConversationsController>(ConversationsController);
    conversationsService = module.get<ConversationsService>(Services.CONVERSATIONS);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createConversation', () => {
    it('should create a new conversation successfully', async () => {
      const mockResult = {
        data: {
          id: 1,
          user1Id: 1,
          user2Id: 2,
          createdAt: new Date(),
          updatedAt: new Date(),
          messages: [],
        },
        metadata: {
          totalItems: 0,
          page: 1,
          limit: 20,
          totalPages: 0,
        },
      };

      mockConversationsService.create.mockResolvedValue(mockResult);

      const result = await controller.createConversation(mockUser as any, 2);

      expect(result).toEqual({
        status: 'success',
        ...mockResult,
      });
      expect(conversationsService.create).toHaveBeenCalledWith({
        user1Id: 1,
        user2Id: 2,
      });
    });

    it('should return existing conversation if already exists', async () => {
      const mockResult = {
        data: {
          id: 1,
          user1Id: 1,
          user2Id: 2,
          createdAt: new Date(),
          updatedAt: new Date(),
          messages: [
            {
              id: 1,
              text: 'Hello',
              senderId: 2,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
        metadata: {
          totalItems: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      };

      mockConversationsService.create.mockResolvedValue(mockResult);

      const result = await controller.createConversation(mockUser as any, 2);

      expect(result.data.messages).toHaveLength(1);
    });
  });

  describe('getUserConversations', () => {
    it('should return paginated conversations with default pagination', async () => {
      const mockResult = {
        data: [
          {
            id: 1,
            updatedAt: new Date(),
            createdAt: new Date(),
            lastMessage: {
              id: 1,
              text: 'Last message',
              senderId: 2,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            user1: {
              id: 1,
              username: 'user1',
              profile_image_url: null,
              displayName: 'User One',
            },
            user2: {
              id: 2,
              username: 'user2',
              profile_image_url: null,
              displayName: 'User Two',
            },
          },
        ],
        metadata: {
          totalItems: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      };

      mockConversationsService.getConversationsForUser.mockResolvedValue(mockResult);

      const result = await controller.getUserConversations(mockUser as any);

      expect(result).toEqual({
        status: 'success',
        ...mockResult,
      });
      expect(conversationsService.getConversationsForUser).toHaveBeenCalledWith(1, 1, 20);
    });

    it('should return paginated conversations with custom pagination', async () => {
      const mockResult = {
        data: [],
        metadata: {
          totalItems: 0,
          page: 2,
          limit: 10,
          totalPages: 0,
        },
      };

      mockConversationsService.getConversationsForUser.mockResolvedValue(mockResult);

      const result = await controller.getUserConversations(mockUser as any, 2, 10);

      expect(result).toEqual({
        status: 'success',
        ...mockResult,
      });
      expect(conversationsService.getConversationsForUser).toHaveBeenCalledWith(1, 2, 10);
    });

    it('should handle empty conversations list', async () => {
      const mockResult = {
        data: [],
        metadata: {
          totalItems: 0,
          page: 1,
          limit: 20,
          totalPages: 0,
        },
      };

      mockConversationsService.getConversationsForUser.mockResolvedValue(mockResult);

      const result = await controller.getUserConversations(mockUser as any);

      expect(result.data).toEqual([]);
      expect(result.metadata.totalItems).toBe(0);
    });
  });

  describe('getUnseenMessagesCount', () => {
    it('should return unseen conversations count', async () => {
      mockConversationsService.getUnseenConversationsCount.mockResolvedValue(3);

      const result = await controller.getUnseenMessagesCount(mockUser as any);

      expect(result).toEqual({
        status: 'success',
        unseenCount: 3,
      });
      expect(conversationsService.getUnseenConversationsCount).toHaveBeenCalledWith(1);
    });

    it('should return 0 if no unseen conversations', async () => {
      mockConversationsService.getUnseenConversationsCount.mockResolvedValue(0);

      const result = await controller.getUnseenMessagesCount(mockUser as any);

      expect(result).toEqual({
        status: 'success',
        unseenCount: 0,
      });
    });
  });
});
