import { Test, TestingModule } from '@nestjs/testing';
import { MessagesGateway } from './messages.gateway';
import { MessagesService } from './messages.service';
import { Services } from 'src/utils/constants';
import { UnauthorizedException } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

describe('MessagesGateway', () => {
  let gateway: MessagesGateway;
  let messagesService: MessagesService;
  let mockServer: Partial<Server>;
  let mockSocket: Partial<Socket>;

  const mockMessagesService = {
    isUserInConversation: jest.fn(),
    markMessagesAsSeen: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    getConversationUsers: jest.fn(),
  };

  beforeEach(async () => {
    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      sockets: {
        adapter: {
          rooms: new Map(),
        },
      } as any,
    };

    mockSocket = {
      id: 'socket-123',
      data: { userId: 1, username: 'testuser' },
      join: jest.fn(),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      disconnect: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesGateway,
        {
          provide: Services.MESSAGES,
          useValue: mockMessagesService,
        },
      ],
    }).compile();

    gateway = module.get<MessagesGateway>(MessagesGateway);
    messagesService = module.get<MessagesService>(Services.MESSAGES);
    gateway.server = mockServer as Server;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleConnection', () => {
    it('should track connected user and join user room', () => {
      gateway.handleConnection(mockSocket as Socket);

      expect(mockSocket.join).toHaveBeenCalledWith('user_1');
      expect(gateway['connectedUsers'].has(1)).toBe(true);
      expect(gateway['connectedUsers'].get(1)?.has('socket-123')).toBe(true);
    });

    it('should disconnect socket if userId is missing', () => {
      const socketWithoutUser = { ...mockSocket, data: {} };

      gateway.handleConnection(socketWithoutUser as Socket);

      expect(socketWithoutUser.disconnect).toHaveBeenCalled();
    });

    it('should add multiple sockets for the same user', () => {
      const socket1 = { ...mockSocket, id: 'socket-1' };
      const socket2 = { ...mockSocket, id: 'socket-2' };

      gateway.handleConnection(socket1 as Socket);
      gateway.handleConnection(socket2 as Socket);

      expect(gateway['connectedUsers'].get(1)?.size).toBe(2);
    });
  });

  describe('handleDisconnect', () => {
    it('should remove socket from connected users', () => {
      gateway.handleConnection(mockSocket as Socket);
      expect(gateway['connectedUsers'].get(1)?.has('socket-123')).toBe(true);

      gateway.handleDisconnect(mockSocket as Socket);

      expect(gateway['connectedUsers'].has(1)).toBe(false);
    });

    it('should keep user in map if they have other active sockets', () => {
      const socket1 = { ...mockSocket, id: 'socket-1' };
      const socket2 = { ...mockSocket, id: 'socket-2' };

      gateway.handleConnection(socket1 as Socket);
      gateway.handleConnection(socket2 as Socket);

      gateway.handleDisconnect(socket1 as Socket);

      expect(gateway['connectedUsers'].has(1)).toBe(true);
      expect(gateway['connectedUsers'].get(1)?.size).toBe(1);
    });

    it('should handle disconnect gracefully if userId is missing', () => {
      const socketWithoutUser = { ...mockSocket, data: {} };

      expect(() => gateway.handleDisconnect(socketWithoutUser as Socket)).not.toThrow();
    });
  });

  describe('handleJoin', () => {
    it('should allow user to join conversation if they are a participant', async () => {
      mockMessagesService.isUserInConversation.mockResolvedValue(true);
      mockMessagesService.markMessagesAsSeen.mockResolvedValue({ count: 5 });

      const result = await gateway.handleJoin(1, mockSocket as Socket);

      expect(result.status).toBe('success');
      expect(mockSocket.join).toHaveBeenCalledWith('conversation_1');
      expect(messagesService.isUserInConversation).toHaveBeenCalledWith({
        conversationId: 1,
        senderId: 1,
        text: '',
      });
      expect(messagesService.markMessagesAsSeen).toHaveBeenCalledWith(1, 1);
    });

    it('should throw UnauthorizedException if user is not authenticated', async () => {
      const unauthSocket = { ...mockSocket, data: {} };

      await expect(gateway.handleJoin(1, unauthSocket as Socket)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if user is not a participant', async () => {
      mockMessagesService.isUserInConversation.mockResolvedValue(false);

      await expect(gateway.handleJoin(1, mockSocket as Socket)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should handle string conversationId by parsing to number', async () => {
      mockMessagesService.isUserInConversation.mockResolvedValue(true);
      mockMessagesService.markMessagesAsSeen.mockResolvedValue({ count: 0 });

      await gateway.handleJoin('1' as any, mockSocket as Socket);

      expect(mockSocket.join).toHaveBeenCalledWith('conversation_1');
    });
  });

  describe('create', () => {
    const createMessageDto = {
      conversationId: 1,
      senderId: 1,
      text: 'Hello, World!',
    };

    const mockMessage = {
      id: 1,
      senderId: 1,
      conversationId: 1,
      text: 'Hello, World!',
      createdAt: new Date(),
    };

    const mockParticipants = {
      user1Id: 1,
      user2Id: 2,
    };

    beforeEach(() => {
      mockMessagesService.getConversationUsers.mockResolvedValue(mockParticipants);
      mockMessagesService.create.mockResolvedValue(mockMessage);
    });

    it('should create a message and emit to conversation room', async () => {
      const conversationRoom = new Set(['socket-1', 'socket-2']);
      const recipientRoom = new Set(['socket-2']);

      mockServer.sockets!.adapter.rooms.set('conversation_1', conversationRoom);
      mockServer.sockets!.adapter.rooms.set('user_2', recipientRoom);

      const result = await gateway.create(createMessageDto, mockSocket as Socket);

      expect(result.status).toBe('success');
      expect(result.data).toEqual(mockMessage);
      expect(messagesService.create).toHaveBeenCalledWith(createMessageDto);
      expect(mockServer.to).toHaveBeenCalledWith('conversation_1');
      expect(mockServer.emit).toHaveBeenCalledWith('messageCreated', mockMessage);
    });

    it('should throw UnauthorizedException if user is not authenticated', async () => {
      const unauthSocket = { ...mockSocket, data: {} };

      await expect(gateway.create(createMessageDto, unauthSocket as Socket)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if senderId does not match authenticated user', async () => {
      const invalidDto = { ...createMessageDto, senderId: 2 };

      await expect(gateway.create(invalidDto, mockSocket as Socket)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if user is not part of conversation', async () => {
      mockMessagesService.getConversationUsers.mockResolvedValue({
        user1Id: 2,
        user2Id: 3,
      });

      await expect(gateway.create(createMessageDto, mockSocket as Socket)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should send notification to recipient if not in conversation room', async () => {
      const conversationRoom = new Set(['socket-1']);
      const recipientRoom = new Set(['socket-3']);

      mockServer.sockets!.adapter.rooms.set('conversation_1', conversationRoom);
      mockServer.sockets!.adapter.rooms.set('user_2', recipientRoom);

      await gateway.create(createMessageDto, mockSocket as Socket);

      expect(mockServer.to).toHaveBeenCalledWith('user_2');
      expect(mockServer.emit).toHaveBeenCalledWith('newMessageNotification', mockMessage);
    });
  });

  describe('update', () => {
    const updateMessageDto = {
      id: 1,
      senderId: 1,
      text: 'Updated text',
    };

    const mockUpdatedMessage = {
      id: 1,
      senderId: 1,
      conversationId: 1,
      text: 'Updated text',
      updatedAt: new Date(),
    };

    const mockParticipants = {
      user1Id: 1,
      user2Id: 2,
    };

    beforeEach(() => {
      mockMessagesService.update.mockResolvedValue(mockUpdatedMessage);
      mockMessagesService.getConversationUsers.mockResolvedValue(mockParticipants);
    });

    it('should update message and emit to conversation room', async () => {
      const conversationRoom = new Set(['socket-1', 'socket-2']);
      const recipientRoom = new Set(['socket-2']);

      mockServer.sockets!.adapter.rooms.set('conversation_1', conversationRoom);
      mockServer.sockets!.adapter.rooms.set('user_2', recipientRoom);

      const result = await gateway.update(updateMessageDto, mockSocket as Socket);

      expect(result.status).toBe('success');
      expect(result.data).toEqual(mockUpdatedMessage);
      expect(messagesService.update).toHaveBeenCalledWith(updateMessageDto, 1);
      expect(mockServer.to).toHaveBeenCalledWith('conversation_1');
      expect(mockServer.emit).toHaveBeenCalledWith('messageUpdated', mockUpdatedMessage);
    });

    it('should throw UnauthorizedException if user is not authenticated', async () => {
      const unauthSocket = { ...mockSocket, data: {} };

      await expect(gateway.update(updateMessageDto, unauthSocket as Socket)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should send edit notification if recipient not in conversation room', async () => {
      const conversationRoom = new Set(['socket-1']);
      const recipientRoom = new Set(['socket-3']);

      mockServer.sockets!.adapter.rooms.set('conversation_1', conversationRoom);
      mockServer.sockets!.adapter.rooms.set('user_2', recipientRoom);

      await gateway.update(updateMessageDto, mockSocket as Socket);

      expect(mockServer.to).toHaveBeenCalledWith('user_2');
      expect(mockServer.emit).toHaveBeenCalledWith('editMessageNotification', mockUpdatedMessage);
    });
  });

  describe('markMessagesAsSeen', () => {
    const markSeenDto = {
      conversationId: 1,
      userId: 1,
    };

    it('should mark messages as seen and notify others', async () => {
      mockMessagesService.markMessagesAsSeen.mockResolvedValue(undefined);

      const result = await gateway.markMessagesAsSeen(markSeenDto, mockSocket as Socket);

      expect(result.status).toBe('success');
      expect(messagesService.markMessagesAsSeen).toHaveBeenCalledWith(1, 1);
      expect(mockSocket.to).toHaveBeenCalledWith('conversation_1');
      expect(mockSocket.emit).toHaveBeenCalledWith('messagesSeen', {
        conversationId: 1,
        userId: 1,
        timestamp: expect.any(String),
      });
    });

    it('should throw UnauthorizedException if user is not authenticated', async () => {
      const unauthSocket = { ...mockSocket, data: {} };

      await expect(gateway.markMessagesAsSeen(markSeenDto, unauthSocket as Socket)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if userId does not match', async () => {
      const invalidDto = { ...markSeenDto, userId: 2 };

      await expect(gateway.markMessagesAsSeen(invalidDto, mockSocket as Socket)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('handleTyping', () => {
    it('should emit typing event to others in conversation', async () => {
      const result = await gateway.handleTyping({ conversationId: 1 }, mockSocket as Socket);

      expect(result.status).toBe('success');
      expect(mockSocket.to).toHaveBeenCalledWith('conversation_1');
      expect(mockSocket.emit).toHaveBeenCalledWith('userTyping', {
        conversationId: 1,
        userId: 1,
      });
    });

    it('should throw UnauthorizedException if user is not authenticated', async () => {
      const unauthSocket = { ...mockSocket, data: {} };

      await expect(
        gateway.handleTyping({ conversationId: 1 }, unauthSocket as Socket),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('handleStopTyping', () => {
    it('should emit stop typing event to others in conversation', async () => {
      const result = await gateway.handleStopTyping({ conversationId: 1 }, mockSocket as Socket);

      expect(result.status).toBe('success');
      expect(mockSocket.to).toHaveBeenCalledWith('conversation_1');
      expect(mockSocket.emit).toHaveBeenCalledWith('userStoppedTyping', {
        conversationId: 1,
        userId: 1,
      });
    });

    it('should throw UnauthorizedException if user is not authenticated', async () => {
      const unauthSocket = { ...mockSocket, data: {} };

      await expect(
        gateway.handleStopTyping({ conversationId: 1 }, unauthSocket as Socket),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
