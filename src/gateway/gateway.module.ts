import { Module } from '@nestjs/common';
import { SocketGateway } from './socket.gateway';
import { SocketService } from './socket.service';
import { MessagesModule } from 'src/messages/messages.module';

@Module({
  imports: [MessagesModule],
  providers: [SocketGateway, SocketService],
  exports: [SocketService, SocketGateway],
})
export class GatewayModule {}
