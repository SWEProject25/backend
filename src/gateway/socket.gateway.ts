import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Inject, UnauthorizedException, UseFilters } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Services } from 'src/utils/constants';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import redisConfig from 'src/config/redis.config';
import { MessagesService } from 'src/messages/messages.service';
import { CreateMessageDto } from 'src/messages/dto/create-message.dto';
import { UpdateMessageDto } from 'src/messages/dto/update-message.dto';
import { MarkSeenDto } from 'src/messages/dto/mark-seen.dto';
import { WebSocketExceptionFilter } from 'src/messages/exceptions/ws-exception.filter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationType } from 'src/notifications/enums/notification.enum';

@WebSocketGateway(8000, {
  cors: {
    origin: '*', // adjust for production
  },
})
@UseFilters(new WebSocketExceptionFilter())
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  constructor(
    @Inject(Services.MESSAGES)
    private readonly messagesService: MessagesService,
    @Inject(redisConfig.KEY)
    private readonly redisConfiguration: ConfigType<typeof redisConfig>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @WebSocketServer()
  server: Server;

  async afterInit(server: Server) {
    // Create Redis clients for the adapter
    const pubClient = createClient({
      socket: {
        host: this.redisConfiguration.redisHost,
        port: this.redisConfiguration.redisPort,
      },
    });
    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);

    // Set up Redis adapter for Socket.IO
    server.adapter(createAdapter(pubClient, subClient));

    console.log('Socket.IO Redis adapter initialized');
  }

  handleConnection(client: Socket) {
    try {
      const userId = client.data.userId;

      if (!userId) {
        console.warn(`Client ${client.id} connected without authentication`);
        client.disconnect();
        return;
      }

      // Join user's personal room for notifications
      client.join(`user_${userId}`);
      console.log(`User ${userId} connected with socket ID ${client.id}`);
    } catch (error) {
      console.error(`Connection error: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    try {
      const userId = client.data.userId;

      if (userId) {
        console.log(`User ${userId} disconnected with socket ID ${client.id}`);
      }
    } catch (error) {
      console.error(`Disconnect error: ${error.message}`);
    }
  }

  // ======================== CONVERSATION HANDLERS ========================

  @SubscribeMessage('joinConversation')
  async handleJoin(@MessageBody() conversationId: number, @ConnectedSocket() socket: Socket) {
    try {
      const userId = socket.data.userId;
      const parsedConversationId = Number(conversationId);

      if (!userId) {
        throw new UnauthorizedException('User not authenticated');
      }

      // Verify user is part of the conversation
      const isParticipant = await this.messagesService.isUserInConversation({
        conversationId: parsedConversationId,
        senderId: userId,
        text: '', // dummy value for validation
      });

      if (!isParticipant) {
        throw new UnauthorizedException('You are not part of this conversation');
      }

      socket.join(`conversation_${parsedConversationId}`);

      // Automatically mark messages as seen when joining
      try {
        await this.messagesService.markMessagesAsSeen(parsedConversationId, userId);
      } catch (error) {
        console.warn(`Could not mark messages as seen: ${error.message}`);
      }

      return {
        status: 'success',
        parsedConversationId,
        message: 'Joined conversation successfully',
      };
    } catch (error) {
      console.error(`Error joining conversation: ${error.message}`);
      throw error;
    }
  }

  @SubscribeMessage('leaveConversation')
  async handleLeave(@MessageBody() conversationId: number, @ConnectedSocket() socket: Socket) {
    try {
      const userId = socket.data.userId;
      const parsedConversationId = Number(conversationId);

      if (!userId) {
        throw new UnauthorizedException('User not authenticated');
      }

      socket.leave(`conversation_${parsedConversationId}`);

      return {
        status: 'success',
        parsedConversationId,
        message: 'Left conversation successfully',
      };
    } catch (error) {
      console.error(`Error leaving conversation: ${error.message}`);
      throw error;
    }
  }

  @SubscribeMessage('createMessage')
  async create(
    @MessageBody() createMessageDto: CreateMessageDto,
    @ConnectedSocket() socket: Socket,
  ) {
    try {
      const userId = socket.data.userId;

      if (!userId) {
        throw new UnauthorizedException('User not authenticated');
      }

      // Verify the sender ID matches authenticated user
      if (createMessageDto.senderId !== userId) {
        console.log(
          `Unauthorized message send attempt by user ${userId}, trying to send as ${createMessageDto.senderId}`,
        );
        throw new UnauthorizedException('Cannot send message as another user');
      }

      const participants = await this.messagesService.getConversationUsers(
        createMessageDto.conversationId,
      );

      if (userId !== participants.user1Id && userId !== participants.user2Id) {
        throw new UnauthorizedException('You are not part of this conversation');
      }

      const recipientId =
        userId === participants.user1Id ? participants.user2Id : participants.user1Id;

      const { message, unseenCount } = await this.messagesService.create(createMessageDto);

      // Emit to conversation room
      this.server
        .to(`conversation_${createMessageDto.conversationId}`)
        .emit('messageCreated', message);

      const conversationRoom = this.server.sockets.adapter.rooms.get(
        `conversation_${createMessageDto.conversationId}`,
      );
      const recipientRoom = this.server.sockets.adapter.rooms.get(`user_${recipientId}`);

      const isRecipientInConversation =
        conversationRoom &&
        recipientRoom &&
        [...conversationRoom].some((socketId) => recipientRoom.has(socketId));

      if (!isRecipientInConversation) {
        this.server.to(`user_${recipientId}`).emit('newMessageNotification', {...message, unseenCount});

        // Emit DM notification event
        this.eventEmitter.emit('notification.create', {
          type: NotificationType.DM,
          recipientId,
          actorId: userId,
          conversationId: createMessageDto.conversationId,
          messageText: createMessageDto.text,
        });
      }

      return {
        status: 'success',
        data: message,
        unseenCount,
      };
    } catch (error) {
      console.error(`Error creating message: ${error.message}`);
      throw error;
    }
  }

  @SubscribeMessage('updateMessage')
  async update(
    @MessageBody() updateMessageDto: UpdateMessageDto,
    @ConnectedSocket() socket: Socket,
  ) {
    try {
      const userId = socket.data.userId;

      if (!userId) {
        throw new UnauthorizedException('User not authenticated');
      }

      const message = await this.messagesService.update(updateMessageDto, userId);

      // Emit updated message to users in that conversation room
      this.server.to(`conversation_${message.conversationId}`).emit('messageUpdated', message);

      const participants = await this.messagesService.getConversationUsers(message.conversationId);

      const recipientId =
        userId === participants.user1Id ? participants.user2Id : participants.user1Id;

      const conversationRoom = this.server.sockets.adapter.rooms.get(
        `conversation_${message.conversationId}`,
      );

      const recipientRoom = this.server.sockets.adapter.rooms.get(`user_${recipientId}`);

      const isRecipientInConversation =
        conversationRoom &&
        recipientRoom &&
        [...conversationRoom].some((socketId) => recipientRoom.has(socketId));

      if (!isRecipientInConversation) {
        this.server.to(`user_${recipientId}`).emit('editMessageNotification', message);
      }

      return {
        status: 'success',
        data: message,
      };
    } catch (error) {
      console.error(`Error updating message: ${error.message}`);
      throw error;
    }
  }

  @SubscribeMessage('markSeen')
  async markMessagesAsSeen(
    @MessageBody() markSeenDto: MarkSeenDto,
    @ConnectedSocket() socket: Socket,
  ) {
    try {
      const userId = socket.data.userId;

      if (!userId) {
        throw new UnauthorizedException('User not authenticated');
      }

      // Verify the user ID matches
      if (markSeenDto.userId !== userId) {
        throw new UnauthorizedException('Cannot mark messages for another user');
      }

      await this.messagesService.markMessagesAsSeen(markSeenDto.conversationId, markSeenDto.userId);

      socket.to(`conversation_${markSeenDto.conversationId}`).emit('messagesSeen', {
        conversationId: markSeenDto.conversationId,
        userId: markSeenDto.userId,
        timestamp: new Date().toISOString(),
      });

      const participants = await this.messagesService.getConversationUsers(
        markSeenDto.conversationId,
      );
      const recipientId =
        markSeenDto.userId === participants.user1Id ? participants.user2Id : participants.user1Id;

      const conversationRoom = this.server.sockets.adapter.rooms.get(
        `conversation_${markSeenDto.conversationId}`,
      );
      const recipientRoom = this.server.sockets.adapter.rooms.get(`user_${recipientId}`);

      const isRecipientInConversation =
        conversationRoom &&
        recipientRoom &&
        [...conversationRoom].some((socketId) => recipientRoom.has(socketId));

      if (!isRecipientInConversation) {
        this.server.to(`user_${recipientId}`).emit('messagesSeen', {
          conversationId: markSeenDto.conversationId,
          userId: markSeenDto.userId,
          timestamp: new Date().toISOString(),
        });
      }

      return {
        status: 'success',
      };
    } catch (error) {
      console.error(`Error marking messages as seen: ${error.message}`);
      throw error;
    }
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @MessageBody() data: { conversationId: number },
    @ConnectedSocket() socket: Socket,
  ) {
    try {
      const userId = socket.data.userId;

      if (!userId) {
        throw new UnauthorizedException('User not authenticated');
      }

      // Notify others in the conversation
      socket.to(`conversation_${data.conversationId}`).emit('userTyping', {
        conversationId: data.conversationId,
        userId,
      });

      const participants = await this.messagesService.getConversationUsers(data.conversationId);

      if (userId !== participants.user1Id && userId !== participants.user2Id) {
        throw new UnauthorizedException('You are not part of this conversation');
      }

      const recipientId =
        userId === participants.user1Id ? participants.user2Id : participants.user1Id;

      const conversationRoom = this.server.sockets.adapter.rooms.get(
        `conversation_${data.conversationId}`,
      );
      const recipientRoom = this.server.sockets.adapter.rooms.get(`user_${recipientId}`);

      const isRecipientInConversation =
        conversationRoom &&
        recipientRoom &&
        [...conversationRoom].some((socketId) => recipientRoom.has(socketId));

      if (!isRecipientInConversation) {
        this.server.to(`user_${recipientId}`).emit('userTyping', {
          conversationId: data.conversationId,
          userId,
        });
      }

      return { status: 'success' };
    } catch (error) {
      console.error(`Error handling typing event: ${error.message}`);
      throw error;
    }
  }

  @SubscribeMessage('stopTyping')
  async handleStopTyping(
    @MessageBody() data: { conversationId: number },
    @ConnectedSocket() socket: Socket,
  ) {
    try {
      const userId = socket.data.userId;

      if (!userId) {
        throw new UnauthorizedException('User not authenticated');
      }

      // Emit to conversation room
      socket.to(`conversation_${data.conversationId}`).emit('userStoppedTyping', {
        conversationId: data.conversationId,
        userId,
      });

      const participants = await this.messagesService.getConversationUsers(data.conversationId);

      if (userId !== participants.user1Id && userId !== participants.user2Id) {
        throw new UnauthorizedException('You are not part of this conversation');
      }

      const recipientId =
        userId === participants.user1Id ? participants.user2Id : participants.user1Id;

      const conversationRoom = this.server.sockets.adapter.rooms.get(
        `conversation_${data.conversationId}`,
      );
      const recipientRoom = this.server.sockets.adapter.rooms.get(`user_${recipientId}`);

      const isRecipientInConversation =
        conversationRoom &&
        recipientRoom &&
        [...conversationRoom].some((socketId) => recipientRoom.has(socketId));

      if (!isRecipientInConversation) {
        this.server.to(`user_${recipientId}`).emit('userStoppedTyping', {
          conversationId: data.conversationId,
          userId,
        });
      }

      return { status: 'success' };
    } catch (error) {
      console.error(`Error handling stop typing event: ${error.message}`);
      throw error;
    }
  }

  // ======================== POST HANDLERS ========================

  @SubscribeMessage('joinPost')
  async handleJoinPost(@MessageBody() postId: number, @ConnectedSocket() socket: Socket) {
    try {
      const userId = socket.data.userId;

      if (!userId) {
        throw new UnauthorizedException('User not authenticated');
      }

      const parsedPostId = Number(postId);
      socket.join(`post_${parsedPostId}`);

      return {
        status: 'success',
        postId: parsedPostId,
        message: 'Joined post room successfully',
      };
    } catch (error) {
      console.error(`Error joining post room: ${error.message}`);
      throw error;
    }
  }

  @SubscribeMessage('leavePost')
  async handleLeavePost(@MessageBody() postId: number, @ConnectedSocket() socket: Socket) {
    try {
      const userId = socket.data.userId;

      if (!userId) {
        throw new UnauthorizedException('User not authenticated');
      }

      const parsedPostId = Number(postId);
      socket.leave(`post_${parsedPostId}`);

      return {
        status: 'success',
        postId: parsedPostId,
        message: 'Left post room successfully',
      };
    } catch (error) {
      console.error(`Error leaving post room: ${error.message}`);
      throw error;
    }
  }

  // ======================== SOCKET EMIT HELPERS ========================

  /**
   * Emit a post stats update to all clients in the post room
   */
  emitPostStatsUpdate(
    postId: number,
    eventName: 'likeUpdate' | 'repostUpdate' | 'commentUpdate',
    count: number,
  ) {
    this.server.to(`post_${postId}`).emit(eventName, {
      postId,
      count,
    });
  }
}
