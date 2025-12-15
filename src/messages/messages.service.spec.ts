import { Test, TestingModule } from '@nestjs/testing';
import { MessagesService } from './messages.service';
import { PrismaService } from '../prisma/prisma.service';
import { Services } from 'src/utils/constants';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

describe('MessagesService', () => {
  let service: MessagesService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    message: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    conversation: {
      findUnique: jest.fn(),
    },
    block: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    getJSON: jest.fn(),
    setJSON: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: Services.MESSAGES,
          useClass: MessagesService,
        },
        {
          provide: Services.PRISMA,
          useValue: mockPrismaService,
        },
        {
          provide: Services.REDIS,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<MessagesService>(Services.MESSAGES);
    prismaService = module.get<PrismaService>(Services.PRISMA);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createMessageDto = {
      conversationId: 1,
      senderId: 1,
      text: 'Hello, World!',
    };

    it('should create a message successfully', async () => {
      const mockConversation = { id: 1, user1Id: 1, user2Id: 2 };
      const mockMessage = {
        id: 1,
        conversationId: 1,
        messageIndex: 1,
        senderId: 1,
        text: 'Hello, World!',
        createdAt: new Date(),
      };

      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation);
      mockPrismaService.block.findFirst.mockResolvedValue(null);
      mockPrismaService.message.count.mockResolvedValue(1);

      // Mock the transaction
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const prismaMock = {
          conversation: {
            update: jest.fn().mockResolvedValue({}),
          },
          message: {
            create: jest.fn().mockResolvedValue(mockMessage),
          },
        };
        return callback(prismaMock);
      });

      const result = await service.create(createMessageDto);

      expect(result.message).toEqual(mockMessage);
      expect(result.unseenCount).toBe(1);
      expect(mockPrismaService.conversation.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(mockPrismaService.block.findFirst).toHaveBeenCalled();
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('should throw error if conversation not found', async () => {
      mockPrismaService.conversation.findUnique.mockResolvedValue(null);

      await expect(service.create(createMessageDto)).rejects.toThrow('Conversation not found');
    });

    it('should throw ForbiddenException if user is not part of conversation', async () => {
      const mockConversation = { id: 1, user1Id: 3, user2Id: 4 };
      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation);

      await expect(service.create(createMessageDto)).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if user is blocked', async () => {
      const mockConversation = { id: 1, user1Id: 1, user2Id: 2 };
      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation);
      mockPrismaService.block.findFirst.mockResolvedValue({ blockerId: 1 });

      await expect(service.create(createMessageDto)).rejects.toThrow(
        new ForbiddenException('Cannot send message to a blocked user'),
      );
    });

    it('should create message as user2 successfully', async () => {
      const dto = { conversationId: 1, senderId: 2, text: 'Hello!' };
      const mockConversation = { id: 1, user1Id: 1, user2Id: 2 };
      const mockMessage = { id: 1, conversationId: 1, senderId: 2, text: 'Hello!' };

      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation);
      mockPrismaService.block.findFirst.mockResolvedValue(null);
      mockPrismaService.message.count.mockResolvedValue(0);
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          conversation: { update: jest.fn() },
          message: { create: jest.fn().mockResolvedValue(mockMessage) },
        });
      });

      const result = await service.create(dto);

      expect(result.message).toEqual(mockMessage);
    });
  });

  describe('getConversationUsers', () => {
    it('should return user IDs for a conversation', async () => {
      const mockConversation = { user1Id: 1, user2Id: 2 };
      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation);

      const result = await service.getConversationUsers(1);

      expect(result).toEqual({ user1Id: 1, user2Id: 2 });
    });

    it('should return zeros if conversation not found', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockPrismaService.conversation.findUnique.mockResolvedValue(null);

      const result = await service.getConversationUsers(1);

      expect(result).toEqual({ user1Id: 0, user2Id: 0 });
      expect(consoleErrorSpy).toHaveBeenCalledWith('Conversation not found');

      consoleErrorSpy.mockRestore();
    });
  });

  describe('isUserInConversation', () => {
    it('should return true if user is user1', async () => {
      const mockConversation = { user1Id: 1, user2Id: 2 };
      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation);

      const result = await service.isUserInConversation({
        conversationId: 1,
        senderId: 1,
        text: 'test',
      });

      expect(result).toBe(true);
    });

    it('should return true if user is user2', async () => {
      const mockConversation = { user1Id: 1, user2Id: 2 };
      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation);

      const result = await service.isUserInConversation({
        conversationId: 1,
        senderId: 2,
        text: 'test',
      });

      expect(result).toBe(true);
    });

    it('should return false if user is not a participant', async () => {
      const mockConversation = { user1Id: 1, user2Id: 2 };
      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation);

      const result = await service.isUserInConversation({
        conversationId: 1,
        senderId: 3,
        text: 'test',
      });

      expect(result).toBe(false);
    });

    it('should return false if conversation not found', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockPrismaService.conversation.findUnique.mockResolvedValue(null);

      const result = await service.isUserInConversation({
        conversationId: 1,
        senderId: 1,
        text: 'test',
      });

      expect(result).toBe(false);
      consoleErrorSpy.mockRestore();
    });
  });

  describe('getConversationMessages', () => {
    it('should return messages for user1 without cursor', async () => {
      const mockConversation = { user1Id: 1, user2Id: 2 };
      const mockMessages = [
        { id: 2, text: 'Message 2', senderId: 2, isSeen: true, createdAt: new Date(), updatedAt: new Date() },
        { id: 1, text: 'Message 1', senderId: 1, isSeen: false, createdAt: new Date(), updatedAt: new Date() },
      ];

      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation);
      mockPrismaService.block.findFirst.mockResolvedValue(null);
      mockPrismaService.message.findMany.mockResolvedValue(mockMessages);
      mockPrismaService.message.count.mockResolvedValue(2);

      const result = await service.getConversationMessages(1, 1, undefined, 20);

      expect(result.data.length).toBe(2);
      expect(result.metadata.totalItems).toBe(2);
      expect(result.metadata.hasMore).toBe(false);
      expect(mockPrismaService.message.findMany).toHaveBeenCalledWith({
        where: {
          conversationId: 1,
          isDeletedU1: false,
        },
        orderBy: { id: 'desc' },
        take: 20,
        select: expect.any(Object),
      });
    });

    it('should return messages for user2 with cursor', async () => {
      const mockConversation = { user1Id: 1, user2Id: 2 };
      const mockMessages = [
        { id: 1, text: 'Message 1', senderId: 1, isSeen: false, createdAt: new Date(), updatedAt: new Date() },
      ];

      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation);
      mockPrismaService.block.findFirst.mockResolvedValue(null);
      mockPrismaService.message.findMany.mockResolvedValue(mockMessages);
      mockPrismaService.message.count.mockResolvedValue(10);

      const result = await service.getConversationMessages(1, 2, 5, 20);

      expect(mockPrismaService.message.findMany).toHaveBeenCalledWith({
        where: {
          conversationId: 1,
          isDeletedU2: false,
          id: { lt: 5 },
        },
        orderBy: { id: 'desc' },
        take: 20,
        select: expect.any(Object),
      });
      expect(result.metadata.hasMore).toBe(false);
    });

    it('should return hasMore true when limit is reached', async () => {
      const mockConversation = { user1Id: 1, user2Id: 2 };
      const mockMessages = Array(20).fill({}).map((_, i) => ({
        id: 20 - i,
        text: `Message ${i}`,
        senderId: 1,
        isSeen: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation);
      mockPrismaService.block.findFirst.mockResolvedValue(null);
      mockPrismaService.message.findMany.mockResolvedValue(mockMessages);
      mockPrismaService.message.count.mockResolvedValue(30);

      const result = await service.getConversationMessages(1, 1, undefined, 20);

      expect(result.metadata.hasMore).toBe(true);
    });

    it('should throw ConflictException if conversation not found', async () => {
      mockPrismaService.conversation.findUnique.mockResolvedValue(null);

      await expect(service.getConversationMessages(1, 1, undefined, 20)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ForbiddenException if user is not part of conversation', async () => {
      const mockConversation = { user1Id: 1, user2Id: 2 };
      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation);

      await expect(service.getConversationMessages(1, 3, undefined, 20)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if user is blocked', async () => {
      const mockConversation = { user1Id: 1, user2Id: 2 };
      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation);
      mockPrismaService.block.findFirst.mockResolvedValue({ blockerId: 1 });

      await expect(service.getConversationMessages(1, 1, undefined, 20)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should return null lastMessageId when no messages', async () => {
      const mockConversation = { user1Id: 1, user2Id: 2 };
      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation);
      mockPrismaService.block.findFirst.mockResolvedValue(null);
      mockPrismaService.message.findMany.mockResolvedValue([]);
      mockPrismaService.message.count.mockResolvedValue(0);

      const result = await service.getConversationMessages(1, 1, undefined, 20);

      expect(result.metadata.lastMessageId).toBeNull();
    });
  });

  describe('getConversationLostMessages', () => {
    it('should return lost messages for user1', async () => {
      const mockMessages = [
        { id: 11, text: 'New message', senderId: 2 },
        { id: 12, text: 'Another message', senderId: 1 },
      ];

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockPrisma = {
          conversation: {
            findUnique: jest.fn().mockResolvedValue({ user1Id: 1, user2Id: 2 }),
          },
          block: {
            findFirst: jest.fn().mockResolvedValue(null),
          },
          message: {
            findMany: jest.fn().mockResolvedValue(mockMessages),
          },
        };
        return callback(mockPrisma);
      });

      const result = await service.getConversationLostMessages(1, 1, 10);

      expect(result.data).toEqual(mockMessages);
      expect(result.metadata.totalItems).toBe(2);
      expect(result.metadata.firstMessageId).toBe(12);
    });

    it('should return lost messages for user2', async () => {
      const mockMessages = [{ id: 11, text: 'New message', senderId: 1 }];

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockPrisma = {
          conversation: {
            findUnique: jest.fn().mockResolvedValue({ user1Id: 1, user2Id: 2 }),
          },
          block: { findFirst: jest.fn().mockResolvedValue(null) },
          message: { findMany: jest.fn().mockResolvedValue(mockMessages) },
        };
        return callback(mockPrisma);
      });

      const result = await service.getConversationLostMessages(1, 2, 10);

      expect(result.data).toEqual(mockMessages);
    });

    it('should throw ConflictException if conversation not found', async () => {
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockPrisma = {
          conversation: { findUnique: jest.fn().mockResolvedValue(null) },
          block: { findFirst: jest.fn() },
          message: { findMany: jest.fn() },
        };
        return callback(mockPrisma);
      });

      await expect(service.getConversationLostMessages(1, 1, 10)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ForbiddenException if user is not part of conversation', async () => {
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockPrisma = {
          conversation: {
            findUnique: jest.fn().mockResolvedValue({ user1Id: 1, user2Id: 2 }),
          },
          block: { findFirst: jest.fn() },
          message: { findMany: jest.fn() },
        };
        return callback(mockPrisma);
      });

      await expect(service.getConversationLostMessages(1, 3, 10)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if user is blocked', async () => {
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockPrisma = {
          conversation: {
            findUnique: jest.fn().mockResolvedValue({ user1Id: 1, user2Id: 2 }),
          },
          block: { findFirst: jest.fn().mockResolvedValue({ blockerId: 1 }) },
          message: { findMany: jest.fn() },
        };
        return callback(mockPrisma);
      });

      await expect(service.getConversationLostMessages(1, 1, 10)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should return null firstMessageId when no messages', async () => {
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockPrisma = {
          conversation: {
            findUnique: jest.fn().mockResolvedValue({ user1Id: 1, user2Id: 2 }),
          },
          block: { findFirst: jest.fn().mockResolvedValue(null) },
          message: { findMany: jest.fn().mockResolvedValue([]) },
        };
        return callback(mockPrisma);
      });

      const result = await service.getConversationLostMessages(1, 1, 10);

      expect(result.metadata.firstMessageId).toBeNull();
    });
  });

  describe('update', () => {
    it('should update a message successfully', async () => {
      const updateMessageDto = { id: 1, text: 'Updated text', senderId: 1 };
      const mockMessage = {
        id: 1,
        text: 'Old text',
        conversationId: 1,
        senderId: 1,
        Conversation: { user1Id: 1, user2Id: 2 },
      };
      const mockUpdatedMessage = { id: 1, text: 'Updated text', updatedAt: new Date() };

      mockPrismaService.message.findUnique.mockResolvedValue(mockMessage);
      mockPrismaService.block.findFirst.mockResolvedValue(null);
      mockPrismaService.message.update.mockResolvedValue(mockUpdatedMessage);

      const result = await service.update(updateMessageDto, 1);

      expect(result).toEqual(mockUpdatedMessage);
      expect(mockPrismaService.message.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { text: 'Updated text', updatedAt: expect.any(Date) },
      });
    });

    it('should throw NotFoundException if message not found', async () => {
      const updateMessageDto = { id: 1, text: 'Updated text', senderId: 1 };
      mockPrismaService.message.findUnique.mockResolvedValue(null);

      await expect(service.update(updateMessageDto, 1)).rejects.toThrow(NotFoundException);
    });

    it('should throw UnauthorizedException if user is not the sender', async () => {
      const updateMessageDto = { id: 1, text: 'Updated text', senderId: 2 };
      const mockMessage = {
        id: 1,
        text: 'Old text',
        conversationId: 1,
        senderId: 1,
        Conversation: { user1Id: 1, user2Id: 2 },
      };

      mockPrismaService.message.findUnique.mockResolvedValue(mockMessage);

      await expect(service.update(updateMessageDto, 2)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ForbiddenException if user is blocked', async () => {
      const updateMessageDto = { id: 1, text: 'Updated text', senderId: 1 };
      const mockMessage = {
        id: 1,
        text: 'Old text',
        senderId: 1,
        Conversation: { user1Id: 1, user2Id: 2 },
      };

      mockPrismaService.message.findUnique.mockResolvedValue(mockMessage);
      mockPrismaService.block.findFirst.mockResolvedValue({ blockerId: 1 });

      await expect(service.update(updateMessageDto, 1)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('should soft delete message for user1', async () => {
      const removeMessageDto = { userId: 1, conversationId: 1, messageId: 1 };
      const mockConversation = { user1Id: 1, user2Id: 2 };
      const mockMessage = { id: 1, conversationId: 1 };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockPrisma = {
          conversation: { findUnique: jest.fn().mockResolvedValue(mockConversation) },
          message: {
            findFirst: jest.fn().mockResolvedValue(mockMessage),
            update: jest.fn().mockResolvedValue({ ...mockMessage, isDeletedU1: true }),
          },
        };
        return callback(mockPrisma);
      });

      await service.remove(removeMessageDto);

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('should soft delete message for user2', async () => {
      const removeMessageDto = { userId: 2, conversationId: 1, messageId: 1 };
      const mockConversation = { user1Id: 1, user2Id: 2 };
      const mockMessage = { id: 1, conversationId: 1 };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockPrisma = {
          conversation: { findUnique: jest.fn().mockResolvedValue(mockConversation) },
          message: {
            findFirst: jest.fn().mockResolvedValue(mockMessage),
            update: jest.fn().mockResolvedValue({ ...mockMessage, isDeletedU2: true }),
          },
        };
        return callback(mockPrisma);
      });

      await service.remove(removeMessageDto);

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException if conversation not found', async () => {
      const removeMessageDto = { userId: 1, conversationId: 1, messageId: 1 };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockPrisma = {
          conversation: { findUnique: jest.fn().mockResolvedValue(null) },
          message: { findFirst: jest.fn(), update: jest.fn() },
        };
        return callback(mockPrisma);
      });

      await expect(service.remove(removeMessageDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not a participant', async () => {
      const removeMessageDto = { userId: 3, conversationId: 1, messageId: 1 };
      const mockConversation = { user1Id: 1, user2Id: 2 };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockPrisma = {
          conversation: { findUnique: jest.fn().mockResolvedValue(mockConversation) },
          message: { findFirst: jest.fn(), update: jest.fn() },
        };
        return callback(mockPrisma);
      });

      await expect(service.remove(removeMessageDto)).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if message not found', async () => {
      const removeMessageDto = { userId: 1, conversationId: 1, messageId: 1 };
      const mockConversation = { user1Id: 1, user2Id: 2 };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockPrisma = {
          conversation: { findUnique: jest.fn().mockResolvedValue(mockConversation) },
          message: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn() },
        };
        return callback(mockPrisma);
      });

      await expect(service.remove(removeMessageDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('markMessagesAsSeen', () => {
    it('should mark messages as seen successfully', async () => {
      const mockConversation = { user1Id: 1, user2Id: 2 };
      const mockUpdateResult = { count: 5 };

      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation);
      mockPrismaService.message.updateMany.mockResolvedValue(mockUpdateResult);

      const result = await service.markMessagesAsSeen(1, 1);

      expect(result).toEqual(mockUpdateResult);
      expect(mockPrismaService.message.updateMany).toHaveBeenCalledWith({
        where: {
          conversationId: 1,
          senderId: { not: 1 },
          isSeen: false,
        },
        data: {
          isSeen: true,
        },
      });
    });

    it('should throw NotFoundException if conversation not found', async () => {
      mockPrismaService.conversation.findUnique.mockResolvedValue(null);

      await expect(service.markMessagesAsSeen(1, 1)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not a participant', async () => {
      const mockConversation = { user1Id: 1, user2Id: 2 };
      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation);

      await expect(service.markMessagesAsSeen(1, 3)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getUnseenMessagesCount', () => {
    it('should return unseen messages count', async () => {
      mockPrismaService.message.count.mockResolvedValue(3);

      const result = await service.getUnseenMessagesCount(1, 1);

      expect(result).toBe(3);
      expect(mockPrismaService.message.count).toHaveBeenCalledWith({
        where: {
          conversationId: 1,
          senderId: { not: 1 },
          isSeen: false,
        },
      });
    });

    it('should return 0 if no unseen messages', async () => {
      mockPrismaService.message.count.mockResolvedValue(0);

      const result = await service.getUnseenMessagesCount(1, 1);

      expect(result).toBe(0);
    });
  });
});
