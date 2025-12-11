import { Test, TestingModule } from '@nestjs/testing';
import { ConversationsService } from './conversations.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictException } from '@nestjs/common';
import { Services } from 'src/utils/constants';

describe('ConversationsService', () => {
  let service: ConversationsService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    conversation: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
    message: {
      count: jest.fn(),
    },
    block: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: Services.CONVERSATIONS,
          useClass: ConversationsService,
        },
        {
          provide: Services.PRISMA,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ConversationsService>(Services.CONVERSATIONS);
    prismaService = module.get<PrismaService>(Services.PRISMA);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new conversation when none exists', async () => {
      const createConversationDto = { user1Id: 1, user2Id: 2 };
      const mockConversation = {
        id: 1,
        user1Id: 1,
        user2Id: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
        Messages: [],
      };

      mockPrismaService.block.findFirst.mockResolvedValue(null);
      mockPrismaService.conversation.findFirst.mockResolvedValue(null);
      mockPrismaService.conversation.create.mockResolvedValue(mockConversation);

      const result = await service.create(createConversationDto);

      expect(result).toEqual({
        data: {
          id: 1,
          user1Id: 1,
          user2Id: 2,
          createdAt: mockConversation.createdAt,
          updatedAt: mockConversation.updatedAt,
          messages: [],
        },
        metadata: {
          totalItems: 0,
          limit: 20,
          hasMore: false,
          lastMessageId: null,
          newestMessageId: null,
        },
      });
      expect(mockPrismaService.conversation.create).toHaveBeenCalledWith({
        data: { user1Id: 1, user2Id: 2 },
        include: { Messages: true },
      });
    });

    it('should return existing conversation with messages', async () => {
      const createConversationDto = { user1Id: 2, user2Id: 1 };
      const mockMessages = [
        {
          id: 1,
          text: 'Hello',
          senderId: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      const mockConversation = {
        id: 1,
        user1Id: 1,
        user2Id: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
        Messages: mockMessages,
      };

      mockPrismaService.block.findFirst.mockResolvedValue(null);
      mockPrismaService.conversation.findFirst.mockResolvedValue(mockConversation);
      mockPrismaService.message.count.mockResolvedValue(1);

      const result = await service.create(createConversationDto);

      expect(result.data.messages).toEqual(mockMessages.reverse());
      expect(result.metadata.totalItems).toBe(1);
    });

    it('should return hasMore true when 20 messages exist', async () => {
      const createConversationDto = { user1Id: 1, user2Id: 2 };
      const mockMessages = Array(20).fill({}).map((_, i) => ({
        id: i + 1,
        text: `Message ${i}`,
        senderId: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
      const mockConversation = {
        id: 1,
        user1Id: 1,
        user2Id: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
        Messages: mockMessages,
      };

      mockPrismaService.block.findFirst.mockResolvedValue(null);
      mockPrismaService.conversation.findFirst.mockResolvedValue(mockConversation);
      mockPrismaService.message.count.mockResolvedValue(50);

      const result = await service.create(createConversationDto);

      expect(result.metadata.hasMore).toBe(true);
      expect(result.metadata.totalItems).toBe(50);
    });

    it('should normalize user IDs (user1Id < user2Id)', async () => {
      const createConversationDto = { user1Id: 5, user2Id: 3 };

      mockPrismaService.block.findFirst.mockResolvedValue(null);
      mockPrismaService.conversation.findFirst.mockResolvedValue(null);
      mockPrismaService.conversation.create.mockResolvedValue({
        id: 1,
        user1Id: 3,
        user2Id: 5,
        Messages: [],
      });

      await service.create(createConversationDto);

      expect(mockPrismaService.conversation.findFirst).toHaveBeenCalledWith({
        where: { user1Id: 3, user2Id: 5 },
        include: expect.any(Object),
      });
    });

    it('should throw ConflictException if user tries to create conversation with themselves', async () => {
      const createConversationDto = { user1Id: 1, user2Id: 1 };

      await expect(service.create(createConversationDto)).rejects.toThrow(
        new ConflictException('A user cannot create a conversation with themselves'),
      );
    });

    it('should throw ConflictException if user is blocked', async () => {
      const createConversationDto = { user1Id: 1, user2Id: 2 };

      mockPrismaService.block.findFirst.mockResolvedValue({ blockerId: 1 });

      await expect(service.create(createConversationDto)).rejects.toThrow(
        new ConflictException('A user cannot create a conversation with a blocked user'),
      );
    });

    it('should use correct deletedField for user2', async () => {
      const createConversationDto = { user1Id: 2, user2Id: 1 }; // User is user2 after normalization
      const mockConversation = {
        id: 1,
        user1Id: 1,
        user2Id: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
        Messages: [],
      };

      mockPrismaService.block.findFirst.mockResolvedValue(null);
      mockPrismaService.conversation.findFirst.mockResolvedValue(mockConversation);
      mockPrismaService.message.count.mockResolvedValue(0);

      await service.create(createConversationDto);

      expect(mockPrismaService.conversation.findFirst).toHaveBeenCalledWith({
        where: { user1Id: 1, user2Id: 2 },
        include: expect.objectContaining({
          Messages: expect.objectContaining({
            where: { isDeletedU2: false },
          }),
        }),
      });
    });
  });

  describe('getConversationsForUser', () => {
    it('should return paginated conversations for user', async () => {
      const mockConversations = [
        {
          id: 1,
          updatedAt: new Date(),
          createdAt: new Date(),
          User1: {
            id: 1,
            username: 'user1',
            Profile: { name: 'User One', profile_image_url: null },
          },
          User2: {
            id: 2,
            username: 'user2',
            Profile: { name: 'User Two', profile_image_url: null },
          },
          Messages: [
            {
              id: 1,
              text: 'Last message',
              senderId: 2,
              createdAt: new Date(),
              updatedAt: new Date(),
              isDeletedU1: false,
              isDeletedU2: false,
            },
          ],
        },
      ];

      mockPrismaService.$transaction.mockResolvedValue([mockConversations, 1, [], []]);
      mockPrismaService.message.count.mockResolvedValue(1);

      const result = await service.getConversationsForUser(1, 1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toHaveProperty('lastMessage');
      expect(result.data[0]).toHaveProperty('user');
      expect(result.data[0].user).toEqual({
        id: 2,
        username: 'user2',
        profile_image_url: null,
        displayName: 'User Two',
      });
      expect(result.metadata).toEqual({
        totalItems: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });

    it('should filter out deleted messages for user1', async () => {
      const mockConversations = [
        {
          id: 1,
          updatedAt: new Date(),
          createdAt: new Date(),
          User1: {
            id: 1,
            username: 'user1',
            Profile: { name: 'User One', profile_image_url: null },
          },
          User2: {
            id: 2,
            username: 'user2',
            Profile: { name: 'User Two', profile_image_url: null },
          },
          Messages: [
            {
              id: 1,
              text: 'Deleted for user1',
              senderId: 2,
              createdAt: new Date(),
              updatedAt: new Date(),
              isDeletedU1: true,
              isDeletedU2: false,
            },
            {
              id: 2,
              text: 'Visible message',
              senderId: 2,
              createdAt: new Date(),
              updatedAt: new Date(),
              isDeletedU1: false,
              isDeletedU2: false,
            },
          ],
        },
      ];

      mockPrismaService.$transaction.mockResolvedValue([mockConversations, 1, [], []]);
      mockPrismaService.message.count.mockResolvedValue(1);

      const result = await service.getConversationsForUser(1, 1, 20);

      expect(result.data[0].lastMessage?.text).toBe('Visible message');
    });

    it('should filter out deleted messages for user2', async () => {
      const mockConversations = [
        {
          id: 1,
          updatedAt: new Date(),
          createdAt: new Date(),
          User1: {
            id: 1,
            username: 'user1',
            Profile: { name: 'User One', profile_image_url: null },
          },
          User2: {
            id: 2,
            username: 'user2',
            Profile: null,
          },
          Messages: [
            {
              id: 1,
              text: 'Deleted for user2',
              senderId: 1,
              createdAt: new Date(),
              updatedAt: new Date(),
              isDeletedU1: false,
              isDeletedU2: true,
            },
            {
              id: 2,
              text: 'Visible for user2',
              senderId: 1,
              createdAt: new Date(),
              updatedAt: new Date(),
              isDeletedU1: false,
              isDeletedU2: false,
            },
          ],
        },
      ];

      mockPrismaService.$transaction.mockResolvedValue([mockConversations, 1, [], []]);
      mockPrismaService.message.count.mockResolvedValue(0);

      const result = await service.getConversationsForUser(2, 1, 20);

      expect(result.data[0].lastMessage?.text).toBe('Visible for user2');
      // User2 sees User1's info
      expect(result.data[0].user.displayName).toBe('User One');
      expect(result.data[0].user.profile_image_url).toBeNull();
    });

    it('should return null lastMessage if all messages are deleted', async () => {
      const mockConversations = [
        {
          id: 1,
          updatedAt: new Date(),
          createdAt: new Date(),
          User1: {
            id: 1,
            username: 'user1',
            Profile: { name: 'User One', profile_image_url: null },
          },
          User2: {
            id: 2,
            username: 'user2',
            Profile: { name: 'User Two', profile_image_url: null },
          },
          Messages: [
            {
              id: 1,
              text: 'Deleted',
              senderId: 2,
              createdAt: new Date(),
              updatedAt: new Date(),
              isDeletedU1: true,
              isDeletedU2: false,
            },
          ],
        },
      ];

      mockPrismaService.$transaction.mockResolvedValue([mockConversations, 1, [], []]);
      mockPrismaService.message.count.mockResolvedValue(0);

      const result = await service.getConversationsForUser(1, 1, 20);

      expect(result.data[0].lastMessage).toBeNull();
    });

    it('should mark conversation as blocked if user blocked other', async () => {
      const mockConversations = [
        {
          id: 1,
          updatedAt: new Date(),
          createdAt: new Date(),
          User1: { id: 1, username: 'user1', Profile: null },
          User2: { id: 2, username: 'user2', Profile: null },
          Messages: [],
        },
      ];

      // User1 blocked User2
      mockPrismaService.$transaction.mockResolvedValue([
        mockConversations,
        1,
        [{ blockedId: 2 }], // blocked list
        [],                  // blockers list
      ]);
      mockPrismaService.message.count.mockResolvedValue(0);

      const result = await service.getConversationsForUser(1, 1, 20);

      expect(result.data[0].isBlocked).toBe(true);
    });

    it('should mark conversation as blocked if user is blocked by other', async () => {
      const mockConversations = [
        {
          id: 1,
          updatedAt: new Date(),
          createdAt: new Date(),
          User1: { id: 1, username: 'user1', Profile: null },
          User2: { id: 2, username: 'user2', Profile: null },
          Messages: [],
        },
      ];

      // User2 blocked User1
      mockPrismaService.$transaction.mockResolvedValue([
        mockConversations,
        1,
        [],                  // blocked list
        [{ blockerId: 2 }],  // blockers list
      ]);
      mockPrismaService.message.count.mockResolvedValue(0);

      const result = await service.getConversationsForUser(1, 1, 20);

      expect(result.data[0].isBlocked).toBe(true);
    });

    it('should use default page and limit values', async () => {
      mockPrismaService.$transaction.mockResolvedValue([[], 0, [], []]);

      await service.getConversationsForUser(1);

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });
  });

  describe('getUnseenConversationsCount', () => {
    it('should return count of conversations with unseen messages', async () => {
      const mockConversations = [
        {
          id: 1,
          user1Id: 1,
          user2Id: 2,
          Messages: [{ senderId: 2, isSeen: false }],
        },
        {
          id: 2,
          user1Id: 1,
          user2Id: 3,
          Messages: [{ senderId: 3, isSeen: false }],
        },
        {
          id: 3,
          user1Id: 1,
          user2Id: 4,
          Messages: [{ senderId: 1, isSeen: true }], // Sent by user, should not count
        },
        {
          id: 4,
          user1Id: 1,
          user2Id: 5,
          Messages: [{ senderId: 5, isSeen: true }], // Seen, should not count
        },
      ];

      mockPrismaService.conversation.findMany.mockResolvedValue(mockConversations);

      const result = await service.getUnseenConversationsCount(1);

      expect(result).toBe(2);
    });

    it('should return 0 if no unseen messages', async () => {
      const mockConversations = [
        {
          id: 1,
          user1Id: 1,
          user2Id: 2,
          Messages: [{ senderId: 2, isSeen: true }],
        },
      ];

      mockPrismaService.conversation.findMany.mockResolvedValue(mockConversations);

      const result = await service.getUnseenConversationsCount(1);

      expect(result).toBe(0);
    });

    it('should return 0 if no conversations', async () => {
      mockPrismaService.conversation.findMany.mockResolvedValue([]);

      const result = await service.getUnseenConversationsCount(1);

      expect(result).toBe(0);
    });

    it('should not count conversations with no messages', async () => {
      const mockConversations = [
        {
          id: 1,
          user1Id: 1,
          user2Id: 2,
          Messages: [],
        },
      ];

      mockPrismaService.conversation.findMany.mockResolvedValue(mockConversations);

      const result = await service.getUnseenConversationsCount(1);

      expect(result).toBe(0);
    });
  });

  describe('getConversationById', () => {
    it('should return conversation details for user1', async () => {
      const mockConversation = {
        id: 1,
        updatedAt: new Date(),
        createdAt: new Date(),
        User1: { id: 1, username: 'user1', Profile: { name: 'User One', profile_image_url: 'url1' } },
        User2: { id: 2, username: 'user2', Profile: { name: 'User Two', profile_image_url: 'url2' } },
        Messages: [
          { id: 1, text: 'Hello', senderId: 2, createdAt: new Date(), updatedAt: new Date(), isDeletedU1: false, isDeletedU2: false },
        ],
      };

      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation);
      mockPrismaService.block.findFirst.mockResolvedValue(null);
      mockPrismaService.message.count.mockResolvedValue(1);

      const result = await service.getConversationById(1, 1);

      expect(result.data).toEqual({
        id: 1,
        updatedAt: mockConversation.updatedAt,
        createdAt: mockConversation.createdAt,
        unseenCount: 1,
        lastMessage: {
          id: 1,
          text: 'Hello',
          senderId: 2,
          createdAt: mockConversation.Messages[0].createdAt,
          updatedAt: mockConversation.Messages[0].updatedAt,
        },
        isBlocked: false,
        user: {
          id: 2,
          username: 'user2',
          profile_image_url: 'url2',
          displayName: 'User Two',
        },
      });
    });

    it('should return conversation details for user2', async () => {
      const mockConversation = {
        id: 1,
        updatedAt: new Date(),
        createdAt: new Date(),
        User1: { id: 1, username: 'user1', Profile: { name: 'User One', profile_image_url: null } },
        User2: { id: 2, username: 'user2', Profile: null },
        Messages: [],
      };

      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation);
      mockPrismaService.block.findFirst.mockResolvedValue(null);
      mockPrismaService.message.count.mockResolvedValue(0);

      const result = await service.getConversationById(1, 2);

      expect(result.data.user.id).toBe(1);
      expect(result.data.lastMessage).toBeNull();
    });

    it('should throw ConflictException if conversation not found', async () => {
      mockPrismaService.conversation.findUnique.mockResolvedValue(null);

      await expect(service.getConversationById(1, 1)).rejects.toThrow(
        new ConflictException('Conversation not found'),
      );
    });

    it('should throw ConflictException if user is not part of conversation', async () => {
      const mockConversation = {
        id: 1,
        User1: { id: 1 },
        User2: { id: 2 },
        Messages: [],
      };

      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation);
      mockPrismaService.block.findFirst.mockResolvedValue(null);

      await expect(service.getConversationById(1, 3)).rejects.toThrow(
        new ConflictException('You are not part of this conversation'),
      );
    });

    it('should mark isBlocked when block exists', async () => {
      const mockConversation = {
        id: 1,
        updatedAt: new Date(),
        createdAt: new Date(),
        User1: { id: 1, username: 'user1', Profile: null },
        User2: { id: 2, username: 'user2', Profile: null },
        Messages: [],
      };

      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation);
      mockPrismaService.block.findFirst.mockResolvedValue({ blockerId: 1 });
      mockPrismaService.message.count.mockResolvedValue(0);

      const result = await service.getConversationById(1, 1);

      expect(result.data.isBlocked).toBe(true);
    });

    it('should filter deleted messages for user1', async () => {
      const mockConversation = {
        id: 1,
        updatedAt: new Date(),
        createdAt: new Date(),
        User1: { id: 1, username: 'user1', Profile: null },
        User2: { id: 2, username: 'user2', Profile: null },
        Messages: [
          { id: 1, text: 'Deleted', senderId: 2, createdAt: new Date(), updatedAt: new Date(), isDeletedU1: true, isDeletedU2: false },
          { id: 2, text: 'Visible', senderId: 2, createdAt: new Date(), updatedAt: new Date(), isDeletedU1: false, isDeletedU2: false },
        ],
      };

      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation);
      mockPrismaService.block.findFirst.mockResolvedValue(null);
      mockPrismaService.message.count.mockResolvedValue(1);

      const result = await service.getConversationById(1, 1);

      expect(result.data.lastMessage?.text).toBe('Visible');
    });

    it('should filter deleted messages for user2', async () => {
      const mockConversation = {
        id: 1,
        updatedAt: new Date(),
        createdAt: new Date(),
        User1: { id: 1, username: 'user1', Profile: null },
        User2: { id: 2, username: 'user2', Profile: null },
        Messages: [
          { id: 1, text: 'Deleted', senderId: 1, createdAt: new Date(), updatedAt: new Date(), isDeletedU1: false, isDeletedU2: true },
          { id: 2, text: 'Visible', senderId: 1, createdAt: new Date(), updatedAt: new Date(), isDeletedU1: false, isDeletedU2: false },
        ],
      };

      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation);
      mockPrismaService.block.findFirst.mockResolvedValue(null);
      mockPrismaService.message.count.mockResolvedValue(1);

      const result = await service.getConversationById(1, 2);

      expect(result.data.lastMessage?.text).toBe('Visible');
    });
  });

  describe('getConversationUnseenMessagesCount', () => {
    it('should return unseen count for user1', async () => {
      const mockConversation = {
        User1: { id: 1 },
        User2: { id: 2 },
      };

      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation);
      mockPrismaService.message.count.mockResolvedValue(5);

      const result = await service.getConversationUnseenMessagesCount(1, 1);

      expect(result).toBe(5);
    });

    it('should return unseen count for user2', async () => {
      const mockConversation = {
        User1: { id: 1 },
        User2: { id: 2 },
      };

      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation);
      mockPrismaService.message.count.mockResolvedValue(3);

      const result = await service.getConversationUnseenMessagesCount(1, 2);

      expect(result).toBe(3);
    });

    it('should throw ConflictException if conversation not found', async () => {
      mockPrismaService.conversation.findUnique.mockResolvedValue(null);

      await expect(service.getConversationUnseenMessagesCount(1, 1)).rejects.toThrow(
        new ConflictException('Conversation not found'),
      );
    });

    it('should throw ConflictException if user is not part of conversation', async () => {
      const mockConversation = {
        User1: { id: 1 },
        User2: { id: 2 },
      };

      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation);

      await expect(service.getConversationUnseenMessagesCount(1, 3)).rejects.toThrow(
        new ConflictException('You are not part of this conversation'),
      );
    });
  });
});
