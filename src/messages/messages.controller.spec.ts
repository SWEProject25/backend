import { Test, TestingModule } from '@nestjs/testing';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { Services } from 'src/utils/constants';

describe('MessagesController', () => {
  let controller: MessagesController;
  let messagesService: MessagesService;

  const mockMessagesService = {
    getConversationMessages: jest.fn(),
    getConversationLostMessages: jest.fn(),
    remove: jest.fn(),
    getUnseenMessagesCount: jest.fn(),
  };

  const mockUser = {
    id: 1,
    email: 'test@example.com',
    username: 'testuser',
    role: 'USER',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessagesController],
      providers: [
        {
          provide: Services.MESSAGES,
          useValue: mockMessagesService,
        },
      ],
    }).compile();

    controller = module.get<MessagesController>(MessagesController);
    messagesService = module.get<MessagesService>(Services.MESSAGES);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMessages', () => {
    it('should return messages with default pagination', async () => {
      const mockResult = {
        data: [
          {
            id: 1,
            text: 'Hello',
            senderId: 1,
            isSeen: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        metadata: {
          totalItems: 1,
          limit: 20,
          hasMore: false,
          lastMessageId: 1,
        },
      };

      mockMessagesService.getConversationMessages.mockResolvedValue(mockResult);

      const result = await controller.getMessages(mockUser as any, 1);

      expect(result).toEqual({
        status: 'success',
        ...mockResult,
      });
      expect(messagesService.getConversationMessages).toHaveBeenCalledWith(1, 1, undefined, 20);
    });

    it('should return messages with cursor-based pagination', async () => {
      const mockResult = {
        data: [],
        metadata: {
          totalItems: 10,
          limit: 10,
          hasMore: true,
          lastMessageId: 5,
        },
      };

      mockMessagesService.getConversationMessages.mockResolvedValue(mockResult);

      const result = await controller.getMessages(mockUser as any, 1, 15, 10);

      expect(result).toEqual({
        status: 'success',
        ...mockResult,
      });
      expect(messagesService.getConversationMessages).toHaveBeenCalledWith(1, 1, 15, 10);
    });
  });

  describe('getLostMessages', () => {
    it('should return lost messages successfully', async () => {
      const mockResult = {
        data: [
          {
            id: 11,
            conversationId: 1,
            text: 'New message',
            senderId: 2,
            isSeen: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        metadata: {
          totalItems: 1,
          firstMessageId: 11,
        },
      };

      mockMessagesService.getConversationLostMessages.mockResolvedValue(mockResult);

      const result = await controller.getLostMessages(mockUser as any, 1, 10);

      expect(result).toEqual({
        status: 'success',
        ...mockResult,
      });
      expect(messagesService.getConversationLostMessages).toHaveBeenCalledWith(1, 1, 10);
    });

    it('should return empty array when no lost messages', async () => {
      const mockResult = {
        data: [],
        metadata: {
          totalItems: 0,
          firstMessageId: null,
        },
      };

      mockMessagesService.getConversationLostMessages.mockResolvedValue(mockResult);

      const result = await controller.getLostMessages(mockUser as any, 1, 100);

      expect(result).toEqual({
        status: 'success',
        ...mockResult,
      });
    });
  });

  describe('removeMessage', () => {
    it('should delete a message successfully', async () => {
      mockMessagesService.remove.mockResolvedValue(undefined);

      const result = await controller.removeMessage(mockUser as any, 1, 1);

      expect(result).toEqual({
        status: 'success',
        message: 'Message deleted successfully',
      });
      expect(messagesService.remove).toHaveBeenCalledWith({
        userId: 1,
        conversationId: 1,
        messageId: 1,
      });
    });
  });

  describe('getUnseenCount', () => {
    it('should return unseen messages count', async () => {
      mockMessagesService.getUnseenMessagesCount.mockResolvedValue(5);

      const result = await controller.getUnseenCount(mockUser as any, 1);

      expect(result).toEqual({
        status: 'success',
        count: 5,
      });
      expect(messagesService.getUnseenMessagesCount).toHaveBeenCalledWith(1, 1);
    });

    it('should return 0 if no unseen messages', async () => {
      mockMessagesService.getUnseenMessagesCount.mockResolvedValue(0);

      const result = await controller.getUnseenCount(mockUser as any, 1);

      expect(result).toEqual({
        status: 'success',
        count: 0,
      });
    });
  });
});
