import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Inject, UnauthorizedException, UseFilters, Logger } from '@nestjs/common';
import { Services } from 'src/utils/constants';
import { Server, Socket } from 'socket.io';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { MarkSeenDto } from './dto/mark-seen.dto';
import { WebSocketExceptionFilter } from './exceptions/ws-exception.filter';

@WebSocketGateway(3000, {
  cors: {
    origin: '*', // adjust for production
  },
})
@UseFilters(new WebSocketExceptionFilter())
export class MessagesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(MessagesGateway.name);
  private readonly connectedUsers = new Map<number, Set<string>>(); // userId -> Set of socketIds

  constructor(
    @Inject(Services.MESSAGES)
    private readonly messagesService: MessagesService,
  ) {}

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    try {
      const userId = client.data.userId;

      if (!userId) {
        this.logger.warn(`Client ${client.id} connected without authentication`);
        client.disconnect();
        return;
      }

      // Track connected user
      if (!this.connectedUsers.has(userId)) {
        this.connectedUsers.set(userId, new Set());
      }
      this.connectedUsers.get(userId)!.add(client.id);

      this.logger.log(`User ${userId} connected with socket ${client.id}`);

      // Join user's personal room for notifications
      client.join(`user_${userId}`);
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    try {
      const userId = client.data.userId;

      if (userId) {
        const userSockets = this.connectedUsers.get(userId);
        if (userSockets) {
          userSockets.delete(client.id);
          if (userSockets.size === 0) {
            this.connectedUsers.delete(userId);
          }
        }
        this.logger.log(`User ${userId} disconnected (socket ${client.id})`);
      }
    } catch (error) {
      this.logger.error(`Disconnect error: ${error.message}`);
    }
  }

  private isUserOnline(userId: number): boolean {
    return this.connectedUsers.has(userId) && this.connectedUsers.get(userId)!.size > 0;
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
      this.logger.log(
        `User ${userId} (socket ${socket.id}) joined conversation_${parsedConversationId}`,
      );

      // Automatically mark messages as seen when joining
      try {
        await this.messagesService.markMessagesAsSeen(parsedConversationId, userId);
      } catch (error) {
        this.logger.warn(`Could not mark messages as seen: ${error.message}`);
      }

      return {
        status: 'success',
        parsedConversationId,
        message: 'Joined conversation successfully',
      };
    } catch (error) {
      this.logger.error(`Error joining conversation: ${error.message}`);
      throw error;
    }
  }

  @SubscribeMessage('createMessage')
  async create(@MessageBody() data: any, @ConnectedSocket() socket: Socket) {
    try {
      const userId = socket.data.userId;

      if (!userId) {
        throw new UnauthorizedException('User not authenticated');
      }

      // Parse the data
      let createMessageDto: CreateMessageDto;

      if (typeof data === 'string') {
        try {
          createMessageDto = eval('(' + data + ')');
        } catch {
          const jsonString = data.replace(/(\w+):/g, '"$1":').replace(/'/g, '"');
          createMessageDto = JSON.parse(jsonString);
        }
      } else {
        createMessageDto = data;
      }

      // Verify the sender ID matches authenticated user
      if (createMessageDto.senderId !== userId) {
        throw new UnauthorizedException('Cannot send message as another user');
      }

      this.logger.log(
        `User ${userId} creating message in conversation ${createMessageDto.conversationId}`,
      );

      const isParticipant = await this.messagesService.isUserInConversation(createMessageDto);

      if (!isParticipant) {
        throw new UnauthorizedException('You are not part of this conversation');
      }

      const message = await this.messagesService.create(createMessageDto);

      // Emit to conversation room
      this.server
        .to(`conversation_${createMessageDto.conversationId}`)
        .emit('messageCreated', message);

      return {
        status: 'success',
        data: message,
      };
    } catch (error) {
      this.logger.error(`Error creating message: ${error.message}`);
      throw error;
    }
  }

  @SubscribeMessage('updateMessage')
  async update(@MessageBody() data: any, @ConnectedSocket() socket: Socket) {
    try {
      const userId = socket.data.userId;

      if (!userId) {
        throw new UnauthorizedException('User not authenticated');
      }

      let updateMessageDto: UpdateMessageDto;

      if (typeof data === 'string') {
        try {
          updateMessageDto = eval('(' + data + ')');
        } catch {
          const jsonString = data.replace(/(\w+):/g, '"$1":').replace(/'/g, '"');
          updateMessageDto = JSON.parse(jsonString);
        }
      } else {
        updateMessageDto = data;
      }

      const message = await this.messagesService.update(updateMessageDto);
      this.logger.log(`User ${userId} updated message ${message.id}`);

      // Emit updated message to users in that conversation room
      this.server.to(`conversation_${message.conversationId}`).emit('messageUpdated', message);

      return {
        status: 'success',
        data: message,
      };
    } catch (error) {
      this.logger.error(`Error updating message: ${error.message}`);
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

      const result = await this.messagesService.markMessagesAsSeen(
        markSeenDto.conversationId,
        markSeenDto.userId,
      );

      this.logger.log(
        `User ${userId} marked ${result.count} messages as seen in conversation ${markSeenDto.conversationId}`,
      );

      // Notify other participants in the conversation
      socket.to(`conversation_${markSeenDto.conversationId}`).emit('messagesSeen', {
        conversationId: markSeenDto.conversationId,
        userId: markSeenDto.userId,
        count: result.count,
        timestamp: new Date().toISOString(),
      });

      return {
        status: 'success',
        count: result.count,
      };
    } catch (error) {
      this.logger.error(`Error marking messages as seen: ${error.message}`);
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
      const username = socket.data.username;

      if (!userId) {
        throw new UnauthorizedException('User not authenticated');
      }

      // Notify others in the conversation
      socket.to(`conversation_${data.conversationId}`).emit('userTyping', {
        conversationId: data.conversationId,
        userId,
        username,
      });

      return { status: 'success' };
    } catch (error) {
      this.logger.error(`Error handling typing event: ${error.message}`);
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
      const username = socket.data.username;

      if (!userId) {
        throw new UnauthorizedException('User not authenticated');
      }

      // Notify others in the conversation
      socket.to(`conversation_${data.conversationId}`).emit('userStoppedTyping', {
        conversationId: data.conversationId,
        userId,
        username,
      });

      return { status: 'success' };
    } catch (error) {
      this.logger.error(`Error handling stop typing event: ${error.message}`);
      throw error;
    }
  }
}
