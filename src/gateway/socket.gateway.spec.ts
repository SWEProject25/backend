import { Test, TestingModule } from '@nestjs/testing';
import { SocketGateway } from './socket.gateway';
import { MessagesService } from 'src/messages/messages.service';
import { PostService } from 'src/post/services/post.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Services } from 'src/utils/constants';
import redisConfig from 'src/config/redis.config';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { NotificationType } from 'src/notifications/enums/notification.enum';

// Mock redis module - must use factory function for hoisting
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    duplicate: jest.fn(() => ({
      connect: jest.fn().mockResolvedValue(undefined),
    })),
  })),
}));

// Mock socket.io redis adapter
jest.mock('@socket.io/redis-adapter', () => ({
  createAdapter: jest.fn().mockReturnValue(jest.fn()),
}));

describe('SocketGateway', () => {
  let gateway: SocketGateway;
  let messagesService: jest.Mocked<MessagesService>;
  let postService: jest.Mocked<PostService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  const mockMessagesService = {
    isUserInConversation: jest.fn(),
    markMessagesAsSeen: jest.fn(),
    getConversationUsers: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  const mockPostService = {
    getPostStats: jest.fn(),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  const mockRedisConfig = {
    redisHost: 'localhost',
    redisPort: 6379,
  };

  // Mock socket with required properties
  const createMockSocket = (userId?: number): Partial<Socket> => ({
    id: 'test-socket-id',
    data: { userId },
    join: jest.fn(),
    leave: jest.fn(),
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
    disconnect: jest.fn(),
  });

  // Mock server
  const createMockServer = () => {
    const mockRooms = new Map<string, Set<string>>();
    return {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      sockets: {
        adapter: {
          rooms: mockRooms,
        },
      },
      adapter: jest.fn(),
    };
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocketGateway,
        {
          provide: Services.MESSAGES,
          useValue: mockMessagesService,
        },
        {
          provide: redisConfig.KEY,
          useValue: mockRedisConfig,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        {
          provide: Services.POST,
          useValue: mockPostService,
        },
      ],
    }).compile();

    gateway = module.get<SocketGateway>(SocketGateway);
    messagesService = module.get(Services.MESSAGES);
    postService = module.get(Services.POST);
    eventEmitter = module.get(EventEmitter2);

    // Set up mock server
    gateway.server = createMockServer() as unknown as Server;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should be defined', () => {
      expect(gateway).toBeDefined();
    });
  });

  describe('afterInit', () => {
    it('should initialize Redis adapter', async () => {
      const mockServer = {
        adapter: jest.fn(),
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await gateway.afterInit(mockServer as unknown as Server);

      expect(consoleSpy).toHaveBeenCalledWith('Socket.IO Redis adapter initialized');
      expect(mockServer.adapter).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('handleConnection', () => {
    it('should join user room when authenticated', () => {
      const mockSocket = createMockSocket(1);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      gateway.handleConnection(mockSocket as Socket);

      expect(mockSocket.join).toHaveBeenCalledWith('user_1');
      expect(consoleSpy).toHaveBeenCalledWith('User 1 connected with socket ID test-socket-id');

      consoleSpy.mockRestore();
    });

    it('should disconnect when userId is not present', () => {
      const mockSocket = createMockSocket(undefined);
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      gateway.handleConnection(mockSocket as Socket);

      expect(mockSocket.disconnect).toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Client test-socket-id connected without authentication',
      );

      consoleWarnSpy.mockRestore();
    });

    it('should handle connection errors and disconnect', () => {
      const mockSocket = {
        id: 'test-socket-id',
        data: {},
        join: jest.fn().mockImplementation(() => {
          throw new Error('Join failed');
        }),
        disconnect: jest.fn(),
      };
      Object.defineProperty(mockSocket, 'data', {
        get: () => {
          throw new Error('Access error');
        },
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      gateway.handleConnection(mockSocket as unknown as Socket);

      expect(mockSocket.disconnect).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('handleDisconnect', () => {
    it('should log disconnect when userId is present', () => {
      const mockSocket = createMockSocket(1);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      gateway.handleDisconnect(mockSocket as Socket);

      expect(consoleSpy).toHaveBeenCalledWith(
        'User 1 disconnected with socket ID test-socket-id',
      );

      consoleSpy.mockRestore();
    });

    it('should not log when userId is not present', () => {
      const mockSocket = createMockSocket(undefined);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      gateway.handleDisconnect(mockSocket as Socket);

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle disconnect errors gracefully', () => {
      const mockSocket = {
        id: 'test-socket-id',
        data: {},
      };
      Object.defineProperty(mockSocket, 'data', {
        get: () => {
          throw new Error('Access error');
        },
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      gateway.handleDisconnect(mockSocket as unknown as Socket);

      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('handleJoin (joinConversation)', () => {
    it('should successfully join a conversation', async () => {
      const mockSocket = createMockSocket(1);
      mockMessagesService.isUserInConversation.mockResolvedValue(true);
      mockMessagesService.markMessagesAsSeen.mockResolvedValue({ count: 5 });

      const result = await gateway.handleJoin(1, mockSocket as Socket);

      expect(mockSocket.join).toHaveBeenCalledWith('conversation_1');
      expect(mockMessagesService.markMessagesAsSeen).toHaveBeenCalledWith(1, 1);
      expect(result).toEqual({
        status: 'success',
        parsedConversationId: 1,
        message: 'Joined conversation successfully',
      });
    });

    it('should throw UnauthorizedException when user is not authenticated', async () => {
      const mockSocket = createMockSocket(undefined);

      await expect(gateway.handleJoin(1, mockSocket as Socket)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user is not a participant', async () => {
      const mockSocket = createMockSocket(1);
      mockMessagesService.isUserInConversation.mockResolvedValue(false);

      await expect(gateway.handleJoin(1, mockSocket as Socket)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should handle markMessagesAsSeen error gracefully', async () => {
      const mockSocket = createMockSocket(1);
      mockMessagesService.isUserInConversation.mockResolvedValue(true);
      mockMessagesService.markMessagesAsSeen.mockRejectedValue(new Error('Marking failed'));

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await gateway.handleJoin(1, mockSocket as Socket);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Could not mark messages as seen: Marking failed',
      );
      expect(result.status).toBe('success');

      consoleWarnSpy.mockRestore();
    });

    it('should parse conversationId as number', async () => {
      const mockSocket = createMockSocket(1);
      mockMessagesService.isUserInConversation.mockResolvedValue(true);
      mockMessagesService.markMessagesAsSeen.mockResolvedValue({ count: 0 });

      await gateway.handleJoin('5' as unknown as number, mockSocket as Socket);

      expect(mockMessagesService.isUserInConversation).toHaveBeenCalledWith({
        conversationId: 5,
        senderId: 1,
        text: '',
      });
    });
  });

  describe('handleLeave (leaveConversation)', () => {
    it('should successfully leave a conversation', async () => {
      const mockSocket = createMockSocket(1);

      const result = await gateway.handleLeave(1, mockSocket as Socket);

      expect(mockSocket.leave).toHaveBeenCalledWith('conversation_1');
      expect(result).toEqual({
        status: 'success',
        parsedConversationId: 1,
        message: 'Left conversation successfully',
      });
    });

    it('should throw UnauthorizedException when user is not authenticated', async () => {
      const mockSocket = createMockSocket(undefined);

      await expect(gateway.handleLeave(1, mockSocket as Socket)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should parse conversationId as number', async () => {
      const mockSocket = createMockSocket(1);

      const result = await gateway.handleLeave('10' as unknown as number, mockSocket as Socket);

      expect(result.parsedConversationId).toBe(10);
    });
  });

  describe('create (createMessage)', () => {
    const createMessageDto = {
      conversationId: 1,
      senderId: 1,
      text: 'Hello!',
    };

    it('should create a message and emit to conversation room', async () => {
      const mockSocket = createMockSocket(1);
      const mockMessage = {
        id: 1,
        conversationId: 1,
        senderId: 1,
        text: 'Hello!',
      };

      mockMessagesService.getConversationUsers.mockResolvedValue({
        user1Id: 1,
        user2Id: 2,
      });
      mockMessagesService.create.mockResolvedValue({
        message: mockMessage,
        unseenCount: 1,
      });

      // Set up room mocks - recipient not in conversation room
      gateway.server.sockets.adapter.rooms.set('conversation_1', new Set(['socket-1']));
      gateway.server.sockets.adapter.rooms.set('user_2', new Set(['socket-2']));

      const result = await gateway.create(createMessageDto, mockSocket as Socket);

      expect(mockMessagesService.create).toHaveBeenCalledWith(createMessageDto);
      expect(gateway.server.to).toHaveBeenCalledWith('conversation_1');
      expect(result).toEqual({
        status: 'success',
        data: mockMessage,
        unseenCount: 1,
      });
    });

    it('should throw UnauthorizedException when user is not authenticated', async () => {
      const mockSocket = createMockSocket(undefined);

      await expect(gateway.create(createMessageDto, mockSocket as Socket)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when senderId does not match', async () => {
      const mockSocket = createMockSocket(2);
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await expect(gateway.create(createMessageDto, mockSocket as Socket)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(consoleLogSpy).toHaveBeenCalled();

      consoleLogSpy.mockRestore();
    });

    it('should throw UnauthorizedException when user is not part of conversation', async () => {
      const mockSocket = createMockSocket(1);
      mockMessagesService.getConversationUsers.mockResolvedValue({
        user1Id: 3,
        user2Id: 4,
      });

      await expect(gateway.create(createMessageDto, mockSocket as Socket)).rejects.toThrow(
        new UnauthorizedException('You are not part of this conversation'),
      );
    });

    it('should emit notification when recipient is not in conversation room', async () => {
      const mockSocket = createMockSocket(1);
      const mockMessage = { id: 1, conversationId: 1, senderId: 1, text: 'Hello!' };

      mockMessagesService.getConversationUsers.mockResolvedValue({
        user1Id: 1,
        user2Id: 2,
      });
      mockMessagesService.create.mockResolvedValue({
        message: mockMessage,
        unseenCount: 1,
      });

      // Recipient not in conversation room
      gateway.server.sockets.adapter.rooms.set('conversation_1', new Set(['socket-1']));
      gateway.server.sockets.adapter.rooms.set('user_2', new Set(['socket-3']));

      await gateway.create(createMessageDto, mockSocket as Socket);

      expect(gateway.server.to).toHaveBeenCalledWith('user_2');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('notification.create', {
        type: NotificationType.DM,
        recipientId: 2,
        actorId: 1,
        conversationId: 1,
        messageText: 'Hello!',
      });
    });

    it('should not emit notification when recipient is in conversation room', async () => {
      const mockSocket = createMockSocket(1);
      const mockMessage = { id: 1, conversationId: 1, senderId: 1, text: 'Hello!' };

      mockMessagesService.getConversationUsers.mockResolvedValue({
        user1Id: 1,
        user2Id: 2,
      });
      mockMessagesService.create.mockResolvedValue({
        message: mockMessage,
        unseenCount: 1,
      });

      // Recipient IS in conversation room (same socket in both rooms)
      const socketSet = new Set(['socket-2']);
      gateway.server.sockets.adapter.rooms.set('conversation_1', socketSet);
      gateway.server.sockets.adapter.rooms.set('user_2', socketSet);

      await gateway.create(createMessageDto, mockSocket as Socket);

      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should handle ForbiddenException and return error status', async () => {
      const mockSocket = createMockSocket(1);
      mockMessagesService.getConversationUsers.mockResolvedValue({
        user1Id: 1,
        user2Id: 2,
      });
      mockMessagesService.create.mockRejectedValue(new ForbiddenException('User is blocked'));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await gateway.create(createMessageDto, mockSocket as Socket);

      expect(result).toEqual({
        status: 'error',
        message: 'User is blocked',
      });

      consoleErrorSpy.mockRestore();
    });

    it('should calculate recipientId correctly when user is user2', async () => {
      const mockSocket = createMockSocket(2);
      const dto = { conversationId: 1, senderId: 2, text: 'Hi!' };
      const mockMessage = { id: 1, conversationId: 1, senderId: 2, text: 'Hi!' };

      mockMessagesService.getConversationUsers.mockResolvedValue({
        user1Id: 1,
        user2Id: 2,
      });
      mockMessagesService.create.mockResolvedValue({
        message: mockMessage,
        unseenCount: 1,
      });

      // Set up rooms
      gateway.server.sockets.adapter.rooms.set('conversation_1', new Set(['socket-1']));
      gateway.server.sockets.adapter.rooms.set('user_1', new Set(['socket-3']));

      await gateway.create(dto, mockSocket as Socket);

      // Check that user_1 is the recipient
      expect(gateway.server.to).toHaveBeenCalledWith('user_1');
    });
  });

  describe('update (updateMessage)', () => {
    const updateMessageDto = {
      id: 1,
      text: 'Updated message',
      senderId: 1,
    };

    it('should update a message and emit to conversation room', async () => {
      const mockSocket = createMockSocket(1);
      const mockMessage = {
        id: 1,
        conversationId: 1,
        text: 'Updated message',
      };

      mockMessagesService.update.mockResolvedValue(mockMessage);
      mockMessagesService.getConversationUsers.mockResolvedValue({
        user1Id: 1,
        user2Id: 2,
      });

      // Set up rooms
      gateway.server.sockets.adapter.rooms.set('conversation_1', new Set(['socket-1']));
      gateway.server.sockets.adapter.rooms.set('user_2', new Set(['socket-2']));

      const result = await gateway.update(updateMessageDto, mockSocket as Socket);

      expect(mockMessagesService.update).toHaveBeenCalledWith(updateMessageDto, 1);
      expect(gateway.server.to).toHaveBeenCalledWith('conversation_1');
      expect(result).toEqual({
        status: 'success',
        data: mockMessage,
      });
    });

    it('should throw UnauthorizedException when user is not authenticated', async () => {
      const mockSocket = createMockSocket(undefined);

      await expect(gateway.update(updateMessageDto, mockSocket as Socket)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should emit edit notification when recipient not in conversation', async () => {
      const mockSocket = createMockSocket(1);
      const mockMessage = { id: 1, conversationId: 1, text: 'Updated' };

      mockMessagesService.update.mockResolvedValue(mockMessage);
      mockMessagesService.getConversationUsers.mockResolvedValue({
        user1Id: 1,
        user2Id: 2,
      });

      // Recipient not in conversation room
      gateway.server.sockets.adapter.rooms.set('conversation_1', new Set(['socket-1']));
      gateway.server.sockets.adapter.rooms.set('user_2', new Set(['socket-3']));

      await gateway.update(updateMessageDto, mockSocket as Socket);

      expect(gateway.server.to).toHaveBeenCalledWith('user_2');
    });

    it('should not emit edit notification when recipient is in conversation', async () => {
      const mockSocket = createMockSocket(1);
      const mockMessage = { id: 1, conversationId: 1, text: 'Updated' };

      mockMessagesService.update.mockResolvedValue(mockMessage);
      mockMessagesService.getConversationUsers.mockResolvedValue({
        user1Id: 1,
        user2Id: 2,
      });

      // Recipient IS in conversation room
      const socketSet = new Set(['socket-2']);
      gateway.server.sockets.adapter.rooms.set('conversation_1', socketSet);
      gateway.server.sockets.adapter.rooms.set('user_2', socketSet);

      const toSpy = jest.fn().mockReturnThis();
      gateway.server.to = toSpy;

      await gateway.update(updateMessageDto, mockSocket as Socket);

      // Should only be called with conversation room, not with user room
      expect(toSpy).toHaveBeenCalledWith('conversation_1');
      expect(toSpy).not.toHaveBeenCalledWith('user_2');
    });

    it('should handle ForbiddenException and return error status', async () => {
      const mockSocket = createMockSocket(1);
      mockMessagesService.update.mockRejectedValue(new ForbiddenException('User is blocked'));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await gateway.update(updateMessageDto, mockSocket as Socket);

      expect(result).toEqual({
        status: 'error',
        message: 'User is blocked',
      });

      consoleErrorSpy.mockRestore();
    });

    it('should calculate recipientId correctly when user is user2', async () => {
      const mockSocket = createMockSocket(2);
      const dto = { id: 1, text: 'Updated message', senderId: 2 };
      const mockMessage = { id: 1, conversationId: 1, text: 'Updated message' };

      mockMessagesService.update.mockResolvedValue(mockMessage);
      mockMessagesService.getConversationUsers.mockResolvedValue({
        user1Id: 1,
        user2Id: 2,
      });

      // Set up rooms - recipient (user1) not in conversation room
      gateway.server.sockets.adapter.rooms.set('conversation_1', new Set(['socket-1']));
      gateway.server.sockets.adapter.rooms.set('user_1', new Set(['socket-3']));

      await gateway.update(dto, mockSocket as Socket);

      // Check that user_1 is the recipient
      expect(gateway.server.to).toHaveBeenCalledWith('user_1');
    });
  });

  describe('markMessagesAsSeen', () => {
    const markSeenDto = {
      conversationId: 1,
      userId: 1,
    };

    it('should mark messages as seen and emit to room', async () => {
      const mockSocket = createMockSocket(1);
      mockSocket.to = jest.fn().mockReturnThis();

      mockMessagesService.markMessagesAsSeen.mockResolvedValue({ count: 5 });
      mockMessagesService.getConversationUsers.mockResolvedValue({
        user1Id: 1,
        user2Id: 2,
      });

      // Set up rooms
      gateway.server.sockets.adapter.rooms.set('conversation_1', new Set(['socket-1']));
      gateway.server.sockets.adapter.rooms.set('user_2', new Set(['socket-2']));

      const result = await gateway.markMessagesAsSeen(markSeenDto, mockSocket as Socket);

      expect(mockMessagesService.markMessagesAsSeen).toHaveBeenCalledWith(1, 1);
      expect(mockSocket.to).toHaveBeenCalledWith('conversation_1');
      expect(result).toEqual({ status: 'success' });
    });

    it('should throw UnauthorizedException when user is not authenticated', async () => {
      const mockSocket = createMockSocket(undefined);

      await expect(
        gateway.markMessagesAsSeen(markSeenDto, mockSocket as Socket),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when userId does not match', async () => {
      const mockSocket = createMockSocket(2);

      await expect(
        gateway.markMessagesAsSeen(markSeenDto, mockSocket as Socket),
      ).rejects.toThrow(new UnauthorizedException('Cannot mark messages for another user'));
    });

    it('should emit to recipient when not in conversation room', async () => {
      const mockSocket = createMockSocket(1);
      mockSocket.to = jest.fn().mockReturnThis();

      mockMessagesService.markMessagesAsSeen.mockResolvedValue({ count: 5 });
      mockMessagesService.getConversationUsers.mockResolvedValue({
        user1Id: 1,
        user2Id: 2,
      });

      // Recipient not in conversation room
      gateway.server.sockets.adapter.rooms.set('conversation_1', new Set(['socket-1']));
      gateway.server.sockets.adapter.rooms.set('user_2', new Set(['socket-3']));

      await gateway.markMessagesAsSeen(markSeenDto, mockSocket as Socket);

      expect(gateway.server.to).toHaveBeenCalledWith('user_2');
    });

    it('should calculate recipientId correctly when user is user2', async () => {
      const dto = { conversationId: 1, userId: 2 };
      const mockSocket = createMockSocket(2);
      mockSocket.to = jest.fn().mockReturnThis();

      mockMessagesService.markMessagesAsSeen.mockResolvedValue({ count: 5 });
      mockMessagesService.getConversationUsers.mockResolvedValue({
        user1Id: 1,
        user2Id: 2,
      });

      // Set up rooms - recipient (user1) not in conversation room
      gateway.server.sockets.adapter.rooms.set('conversation_1', new Set(['socket-1']));
      gateway.server.sockets.adapter.rooms.set('user_1', new Set(['socket-3']));

      await gateway.markMessagesAsSeen(dto, mockSocket as Socket);

      expect(gateway.server.to).toHaveBeenCalledWith('user_1');
    });
  });

  describe('handleTyping', () => {
    it('should emit typing event to conversation room', async () => {
      const mockSocket = createMockSocket(1);
      mockSocket.to = jest.fn().mockReturnThis();

      mockMessagesService.getConversationUsers.mockResolvedValue({
        user1Id: 1,
        user2Id: 2,
      });

      // Set up rooms
      gateway.server.sockets.adapter.rooms.set('conversation_1', new Set(['socket-1']));
      gateway.server.sockets.adapter.rooms.set('user_2', new Set(['socket-2']));

      const result = await gateway.handleTyping({ conversationId: 1 }, mockSocket as Socket);

      expect(mockSocket.to).toHaveBeenCalledWith('conversation_1');
      expect(result).toEqual({ status: 'success' });
    });

    it('should throw UnauthorizedException when user is not authenticated', async () => {
      const mockSocket = createMockSocket(undefined);

      await expect(
        gateway.handleTyping({ conversationId: 1 }, mockSocket as Socket),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user is not a participant', async () => {
      const mockSocket = createMockSocket(3);
      mockSocket.to = jest.fn().mockReturnThis();

      mockMessagesService.getConversationUsers.mockResolvedValue({
        user1Id: 1,
        user2Id: 2,
      });

      await expect(
        gateway.handleTyping({ conversationId: 1 }, mockSocket as Socket),
      ).rejects.toThrow(new UnauthorizedException('You are not part of this conversation'));
    });

    it('should emit to recipient when not in conversation room', async () => {
      const mockSocket = createMockSocket(1);
      mockSocket.to = jest.fn().mockReturnThis();

      mockMessagesService.getConversationUsers.mockResolvedValue({
        user1Id: 1,
        user2Id: 2,
      });

      // Recipient not in conversation room
      gateway.server.sockets.adapter.rooms.set('conversation_1', new Set(['socket-1']));
      gateway.server.sockets.adapter.rooms.set('user_2', new Set(['socket-3']));

      await gateway.handleTyping({ conversationId: 1 }, mockSocket as Socket);

      expect(gateway.server.to).toHaveBeenCalledWith('user_2');
    });

    it('should calculate recipientId correctly when user is user2', async () => {
      const mockSocket = createMockSocket(2);
      mockSocket.to = jest.fn().mockReturnThis();

      mockMessagesService.getConversationUsers.mockResolvedValue({
        user1Id: 1,
        user2Id: 2,
      });

      // Set up rooms - recipient (user1) not in conversation room
      gateway.server.sockets.adapter.rooms.set('conversation_1', new Set(['socket-1']));
      gateway.server.sockets.adapter.rooms.set('user_1', new Set(['socket-3']));

      await gateway.handleTyping({ conversationId: 1 }, mockSocket as Socket);

      expect(gateway.server.to).toHaveBeenCalledWith('user_1');
    });
  });

  describe('handleStopTyping', () => {
    it('should emit stop typing event to conversation room', async () => {
      const mockSocket = createMockSocket(1);
      mockSocket.to = jest.fn().mockReturnThis();

      mockMessagesService.getConversationUsers.mockResolvedValue({
        user1Id: 1,
        user2Id: 2,
      });

      // Set up rooms
      gateway.server.sockets.adapter.rooms.set('conversation_1', new Set(['socket-1']));
      gateway.server.sockets.adapter.rooms.set('user_2', new Set(['socket-2']));

      const result = await gateway.handleStopTyping({ conversationId: 1 }, mockSocket as Socket);

      expect(mockSocket.to).toHaveBeenCalledWith('conversation_1');
      expect(result).toEqual({ status: 'success' });
    });

    it('should throw UnauthorizedException when user is not authenticated', async () => {
      const mockSocket = createMockSocket(undefined);

      await expect(
        gateway.handleStopTyping({ conversationId: 1 }, mockSocket as Socket),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user is not a participant', async () => {
      const mockSocket = createMockSocket(3);
      mockSocket.to = jest.fn().mockReturnThis();

      mockMessagesService.getConversationUsers.mockResolvedValue({
        user1Id: 1,
        user2Id: 2,
      });

      await expect(
        gateway.handleStopTyping({ conversationId: 1 }, mockSocket as Socket),
      ).rejects.toThrow(new UnauthorizedException('You are not part of this conversation'));
    });

    it('should emit to recipient when not in conversation room', async () => {
      const mockSocket = createMockSocket(1);
      mockSocket.to = jest.fn().mockReturnThis();

      mockMessagesService.getConversationUsers.mockResolvedValue({
        user1Id: 1,
        user2Id: 2,
      });

      // Recipient not in conversation room
      gateway.server.sockets.adapter.rooms.set('conversation_1', new Set(['socket-1']));
      gateway.server.sockets.adapter.rooms.set('user_2', new Set(['socket-3']));

      await gateway.handleStopTyping({ conversationId: 1 }, mockSocket as Socket);

      expect(gateway.server.to).toHaveBeenCalledWith('user_2');
    });

    it('should calculate recipientId correctly when user is user2', async () => {
      const mockSocket = createMockSocket(2);
      mockSocket.to = jest.fn().mockReturnThis();

      mockMessagesService.getConversationUsers.mockResolvedValue({
        user1Id: 1,
        user2Id: 2,
      });

      // Set up rooms - recipient (user1) not in conversation room
      gateway.server.sockets.adapter.rooms.set('conversation_1', new Set(['socket-1']));
      gateway.server.sockets.adapter.rooms.set('user_1', new Set(['socket-3']));

      await gateway.handleStopTyping({ conversationId: 1 }, mockSocket as Socket);

      expect(gateway.server.to).toHaveBeenCalledWith('user_1');
    });
  });

  describe('handleJoinPost', () => {
    it('should join post room and emit stats', async () => {
      const mockSocket = createMockSocket(1);
      const mockStats = {
        likesCount: 10,
        retweetsCount: 5,
        commentsCount: 3,
      };

      mockPostService.getPostStats.mockResolvedValue(mockStats);

      const result = await gateway.handleJoinPost(1, mockSocket as Socket);

      expect(mockSocket.join).toHaveBeenCalledWith('post_1');
      expect(mockPostService.getPostStats).toHaveBeenCalledWith(1);
      expect(mockSocket.emit).toHaveBeenCalledWith('likeUpdate', { postId: 1, count: 10 });
      expect(mockSocket.emit).toHaveBeenCalledWith('repostUpdate', { postId: 1, count: 5 });
      expect(mockSocket.emit).toHaveBeenCalledWith('commentUpdate', { postId: 1, count: 3 });
      expect(result).toEqual({
        status: 'success',
        postId: 1,
        message: 'Joined post room successfully',
      });
    });

    it('should throw UnauthorizedException when user is not authenticated', async () => {
      const mockSocket = createMockSocket(undefined);

      await expect(gateway.handleJoinPost(1, mockSocket as Socket)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should parse postId as number', async () => {
      const mockSocket = createMockSocket(1);
      mockPostService.getPostStats.mockResolvedValue({
        likesCount: 0,
        retweetsCount: 0,
        commentsCount: 0,
      });

      const result = await gateway.handleJoinPost('5' as unknown as number, mockSocket as Socket);

      expect(result.postId).toBe(5);
      expect(mockSocket.join).toHaveBeenCalledWith('post_5');
    });

    it('should handle getPostStats error', async () => {
      const mockSocket = createMockSocket(1);
      mockPostService.getPostStats.mockRejectedValue(new Error('Stats error'));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(gateway.handleJoinPost(1, mockSocket as Socket)).rejects.toThrow('Stats error');

      consoleErrorSpy.mockRestore();
    });
  });

  describe('handleLeavePost', () => {
    it('should leave post room successfully', async () => {
      const mockSocket = createMockSocket(1);

      const result = await gateway.handleLeavePost(1, mockSocket as Socket);

      expect(mockSocket.leave).toHaveBeenCalledWith('post_1');
      expect(result).toEqual({
        status: 'success',
        postId: 1,
        message: 'Left post room successfully',
      });
    });

    it('should throw UnauthorizedException when user is not authenticated', async () => {
      const mockSocket = createMockSocket(undefined);

      await expect(gateway.handleLeavePost(1, mockSocket as Socket)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should parse postId as number', async () => {
      const mockSocket = createMockSocket(1);

      const result = await gateway.handleLeavePost('10' as unknown as number, mockSocket as Socket);

      expect(result.postId).toBe(10);
      expect(mockSocket.leave).toHaveBeenCalledWith('post_10');
    });
  });

  describe('emitPostStatsUpdate', () => {
    it('should emit likeUpdate to post room', () => {
      gateway.emitPostStatsUpdate(1, 'likeUpdate', 10);

      expect(gateway.server.to).toHaveBeenCalledWith('post_1');
    });

    it('should emit repostUpdate to post room', () => {
      gateway.emitPostStatsUpdate(2, 'repostUpdate', 5);

      expect(gateway.server.to).toHaveBeenCalledWith('post_2');
    });

    it('should emit commentUpdate to post room', () => {
      gateway.emitPostStatsUpdate(3, 'commentUpdate', 15);

      expect(gateway.server.to).toHaveBeenCalledWith('post_3');
    });
  });
});
