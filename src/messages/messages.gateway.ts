import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Inject, UnauthorizedException, UseFilters } from '@nestjs/common';
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
        console.warn(`Client ${client.id} connected without authentication`);
        client.disconnect();
        return;
      }

      // Track connected user
      if (!this.connectedUsers.has(userId)) {
        this.connectedUsers.set(userId, new Set());
      }
      this.connectedUsers.get(userId)!.add(client.id);

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
        const userSockets = this.connectedUsers.get(userId);
        if (userSockets) {
          userSockets.delete(client.id);
          if (userSockets.size === 0) {
            this.connectedUsers.delete(userId);
          }
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
        this.server.to(`user_${recipientId}`).emit('newMessageNotification', message);
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

      // Notify other participants in the conversation
      socket.to(`conversation_${markSeenDto.conversationId}`).emit('messagesSeen', {
        conversationId: markSeenDto.conversationId,
        userId: markSeenDto.userId,
        timestamp: new Date().toISOString(),
      });

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

      socket.to(`conversation_${data.conversationId}`).emit('userStoppedTyping', {
        conversationId: data.conversationId,
        userId,
      });

      return { status: 'success' };
    } catch (error) {
      console.error(`Error handling stop typing event: ${error.message}`);
      throw error;
    }
  }
}
