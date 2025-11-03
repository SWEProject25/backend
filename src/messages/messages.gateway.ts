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
import { Services } from 'src/utils/constants';
import { Server, Socket } from 'socket.io';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { MarkSeenDto } from './dto/mark-seen.dto';
import { WebSocketExceptionFilter } from './exceptions/ws-exception.filter';
import { RedisService } from 'src/redis/redis.service';

@WebSocketGateway(8000, {
  cors: {
    origin: '*', // adjust for production
  },
})
@UseFilters(new WebSocketExceptionFilter())
export class MessagesGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  constructor(
    @Inject(Services.MESSAGES)
    private readonly messagesService: MessagesService,
    @Inject(Services.REDIS)
    private readonly redisService: RedisService,
  ) {}

  @WebSocketServer()
  server: Server;

  async afterInit() {
    try {
      console.log('🔄 Initializing WebSocket Gateway with Redis pub/sub...');

      // Subscribe to message broadcasts from other pods
      await this.redisService.subscribe('message:created', async (message) => {
        const data = JSON.parse(message);
        this.server.to(`conversation_${data.conversationId}`).emit('messageCreated', data.payload);
      });

      await this.redisService.subscribe('message:updated', async (message) => {
        const data = JSON.parse(message);
        this.server.to(`conversation_${data.conversationId}`).emit('messageUpdated', data.payload);
      });

      await this.redisService.subscribe('messages:seen', async (message) => {
        const data = JSON.parse(message);
        this.server.to(`conversation_${data.conversationId}`).emit('messagesSeen', data.payload);
      });

      await this.redisService.subscribe('user:typing', async (message) => {
        const data = JSON.parse(message);
        this.server.to(`conversation_${data.conversationId}`).emit('userTyping', data.payload);
      });

      await this.redisService.subscribe('user:stopTyping', async (message) => {
        const data = JSON.parse(message);
        this.server.to(`conversation_${data.conversationId}`).emit('userStoppedTyping', data.payload);
      });

      await this.redisService.subscribe('message:notification', async (message) => {
        const data = JSON.parse(message);
        this.server.to(`user_${data.userId}`).emit('newMessageNotification', data.payload);
      });

      await this.redisService.subscribe('message:editNotification', async (message) => {
        const data = JSON.parse(message);
        this.server.to(`user_${data.userId}`).emit('editMessageNotification', data.payload);
      });

      console.log('✅ WebSocket Gateway initialized with Redis pub/sub');
    } catch (error) {
      console.error('❌ Failed to initialize WebSocket Gateway:', error);
      throw error;
    }
  }

  async handleConnection(client: Socket) {
    try {
      const userId = client.data.userId;

      if (!userId) {
        console.warn(`Client ${client.id} connected without authentication`);
        client.disconnect();
        return;
      }

      // Track connected user in Redis
      await this.redisService.sAdd(`user:${userId}:sockets`, client.id);

      // Join user's personal room for notifications
      client.join(`user_${userId}`);
      console.log(`User ${userId} connected with socket ID ${client.id}`);
    } catch (error) {
      console.error(`Connection error: ${error.message}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    try {
      const userId = client.data.userId;

      if (userId) {
        // Remove socket from Redis
        await this.redisService.sRem(`user:${userId}:sockets`, client.id);

        // Clean up empty sets (optional, helps with Redis memory)
        const remaining = await this.redisService.sCard(`user:${userId}:sockets`);
        if (remaining === 0) {
          await this.redisService.del(`user:${userId}:sockets`);
        }
      }
    } catch (error) {
      console.error(`Disconnect error: ${error.message}`);
    }
  }

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

      const message = await this.messagesService.create(createMessageDto);

      // Broadcast to ALL pods via Redis pub/sub
      await this.redisService.publish(
        'message:created',
        JSON.stringify({
          conversationId: createMessageDto.conversationId,
          payload: message,
        }),
      );

      // Check if recipient is in conversation room across ALL pods
      const recipientSockets = await this.redisService.sMembers(`user:${recipientId}:sockets`);
      const isRecipientInConversation = recipientSockets.length > 0;

      if (!isRecipientInConversation) {
        await this.redisService.publish(
          'message:notification',
          JSON.stringify({
            userId: recipientId,
            payload: message,
          }),
        );
      }

      return {
        status: 'success',
        data: message,
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

      // Broadcast to ALL pods via Redis
      await this.redisService.publish(
        'message:updated',
        JSON.stringify({
          conversationId: message.conversationId,
          payload: message,
        }),
      );

      const participants = await this.messagesService.getConversationUsers(message.conversationId);

      const recipientId =
        userId === participants.user1Id ? participants.user2Id : participants.user1Id;

      // Check if recipient is connected across ALL pods
      const recipientSockets = await this.redisService.sMembers(`user:${recipientId}:sockets`);
      const isRecipientInConversation = recipientSockets.length > 0;

      if (!isRecipientInConversation) {
        await this.redisService.publish(
          'message:editNotification',
          JSON.stringify({
            userId: recipientId,
            payload: message,
          }),
        );
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

      // Broadcast to ALL pods
      await this.redisService.publish(
        'messages:seen',
        JSON.stringify({
          conversationId: markSeenDto.conversationId,
          payload: {
            conversationId: markSeenDto.conversationId,
            userId: markSeenDto.userId,
            timestamp: new Date().toISOString(),
          },
        }),
      );

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

      // Broadcast to ALL pods
      await this.redisService.publish(
        'user:typing',
        JSON.stringify({
          conversationId: data.conversationId,
          payload: {
            conversationId: data.conversationId,
            userId,
          },
        }),
      );

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

      await this.redisService.publish(
        'user:stopTyping',
        JSON.stringify({
          conversationId: data.conversationId,
          payload: {
            conversationId: data.conversationId,
            userId,
          },
        }),
      );

      return { status: 'success' };
    } catch (error) {
      console.error(`Error handling stop typing event: ${error.message}`);
      throw error;
    }
  }
}
