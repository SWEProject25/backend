import { Test, TestingModule } from '@nestjs/testing';
import { MessagesService } from './messages.service';
import { PrismaService } from '../prisma/prisma.service';
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
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
    prismaService = module.get<PrismaService>(PrismaService);
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
        senderId: 1,
        text: 'Hello, World!',
        createdAt: new Date(),
      };

      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation);
      mockPrismaService.message.create.mockResolvedValue(mockMessage);

      const result = await service.create(createMessageDto);

      expect(result).toEqual(mockMessage);
      expect(mockPrismaService.conversation.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(mockPrismaService.message.create).toHaveBeenCalledWith({
        data: {
          text: 'Hello, World!',
          senderId: 1,
          conversationId: 1,
        },
        select: {
          id: true,
          senderId: true,
          text: true,
          createdAt: true,
        },
      });
    });

    it('should throw error if conversation not found', async () => {
      mockPrismaService.conversation.findUnique.mockResolvedValue(null);

      await expect(service.create(createMessageDto)).rejects.toThrow('Conversation not found');
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
      mockPrismaService.conversation.findUnique.mockResolvedValue(null);

      const result = await service.isUserInConversation({
        conversationId: 1,
        senderId: 1,
        text: 'test',
      });

      expect(result).toBe(false);
    });
  });

  describe('getConversationMessages', () => {
    it('should return paginated messages for user1', async () => {
      const mockConversation = { user1Id: 1, user2Id: 2 };
      const mockMessages = [
        {
          id: 1,
          text: 'Message 1',
          senderId: 1,
          isSeen: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          text: 'Message 2',
          senderId: 2,
          isSeen: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation);
      mockPrismaService.message.findMany.mockResolvedValue(mockMessages);
      mockPrismaService.message.count.mockResolvedValue(2);

      const result = await service.getConversationMessages(1, 1, 1, 20);

      expect(result.data).toEqual(mockMessages.reverse());
      expect(result.metadata).toEqual({
        totalItems: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
      expect(mockPrismaService.message.findMany).toHaveBeenCalledWith({
        where: {
          conversationId: 1,
          isDeletedU1: false,
        },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
        select: expect.any(Object),
      });
    });

    it('should return paginated messages for user2', async () => {
      const mockConversation = { user1Id: 1, user2Id: 2 };
      const mockMessages = [
        {
          id: 1,
          text: 'Message 1',
          senderId: 1,
          isSeen: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation);
      mockPrismaService.message.findMany.mockResolvedValue(mockMessages);
      mockPrismaService.message.count.mockResolvedValue(1);

      const result = await service.getConversationMessages(1, 2, 1, 20);

      expect(mockPrismaService.message.findMany).toHaveBeenCalledWith({
        where: {
          conversationId: 1,
          isDeletedU2: false,
        },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
        select: expect.any(Object),
      });
    });

    it('should throw ConflictException if conversation not found', async () => {
      mockPrismaService.conversation.findUnique.mockResolvedValue(null);

      await expect(service.getConversationMessages(1, 1, 1, 20)).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('should update a message successfully', async () => {
      const updateMessageDto = { id: 1, text: 'Updated text', senderId: 1 };
      const mockMessage = { id: 1, text: 'Old text', conversationId: 1, senderId: 1 };
      const mockUpdatedMessage = { id: 1, text: 'Updated text', updatedAt: new Date() };

      mockPrismaService.message.findUnique.mockResolvedValue(mockMessage);
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
      const mockMessage = { id: 1, text: 'Old text', conversationId: 1, senderId: 1 };

      mockPrismaService.message.findUnique.mockResolvedValue(mockMessage);

      await expect(service.update(updateMessageDto, 2)).rejects.toThrow(UnauthorizedException);
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
