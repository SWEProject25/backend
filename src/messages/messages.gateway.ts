import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
} from '@nestjs/websockets';
import { Inject, UnauthorizedException } from '@nestjs/common';
import { Services } from 'src/utils/constants';
import { Server, Socket } from 'socket.io';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';

@WebSocketGateway({
  cors: {
    origin: '*', // adjust for production
  },
})
export class MessagesGateway {
  constructor(
    @Inject(Services.MESSAGES)
    private readonly messagesService: MessagesService,
  ) {}

  @WebSocketServer()
  server: Server;

  onModuleInit() {
    this.server.on('connection', (socket: Socket) => {
      console.log(`Client connected: ${socket.id}`);
    });
  }

  @SubscribeMessage('joinConversation')
  handleJoin(@MessageBody() conversationId: number, @ConnectedSocket() socket: Socket) {
    socket.join(`conversation_${conversationId}`);
    console.log(`Socket ${socket.id} joined conversation_${conversationId}`);

    // Debug: Check what rooms this socket is in
    console.log('Socket rooms:', Array.from(socket.rooms));

    // Debug: Check all sockets in this conversation room
    const room = this.server.sockets.adapter.rooms.get(`conversation_${conversationId}`);
    console.log(`Total sockets in conversation_${conversationId}:`, room?.size || 0);

    return { success: true, conversationId };
  }

  @SubscribeMessage('createMessage')
  async create(@MessageBody() data: any, @ConnectedSocket() socket: Socket) {
    console.log('Raw data received:', data);
    console.log('Type of data:', typeof data);

    // Convert the string representation to actual object
    let createMessageDto: CreateMessageDto;

    if (typeof data === 'string') {
      // Use eval or Function constructor to parse JavaScript object notation
      // Be careful with this approach - only use if you trust the source
      try {
        createMessageDto = eval('(' + data + ')');
      } catch {
        // Fallback: try to convert to proper JSON format
        const jsonString = data
          .replace(/(\w+):/g, '"$1":') // Add quotes around keys
          .replace(/'/g, '"'); // Replace single quotes with double
        createMessageDto = JSON.parse(jsonString);
      }
    } else {
      createMessageDto = data;
    }

    console.log('Parsed message data:', createMessageDto);

    const isParticipant = await this.messagesService.isUserInConversation(createMessageDto);

    if (!isParticipant) {
      throw new UnauthorizedException('You are not part of this conversation');
    }

    const message = await this.messagesService.create(createMessageDto);

    this.server
      .to(`conversation_${createMessageDto.conversationId}`)
      .emit('messageCreated', message);

    return message;
  }

  @SubscribeMessage('updateMessage')
  async update(@MessageBody() updateMessageDto: UpdateMessageDto) {
    const message = await this.messagesService.update(updateMessageDto);

    // Emit updated message to users in that conversation room
    this.server.to(`conversation_${message.conversationId}`).emit('messageUpdated', message);
    return message;
  }
}
