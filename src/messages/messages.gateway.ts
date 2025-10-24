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
  }

  @SubscribeMessage('createMessage')
  async create(@MessageBody() createMessageDto: CreateMessageDto) {
    // Validate that the sender is part of the conversation
    const isParticipant = await this.messagesService.isUserInConversation(
      createMessageDto.conversationId,
      createMessageDto.senderId,
    );

    if (!isParticipant) {
      throw new UnauthorizedException('You are not part of this conversation');
    }

    const message = await this.messagesService.create(createMessageDto);

    // Emit message only to users in that conversation room
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
