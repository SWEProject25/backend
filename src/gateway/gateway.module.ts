import { forwardRef, Module } from '@nestjs/common';
import { SocketGateway } from './socket.gateway';
import { SocketService } from './socket.service';
import { MessagesModule } from 'src/messages/messages.module';
import { PostModule } from 'src/post/post.module';

@Module({
  imports: [MessagesModule, forwardRef(() => PostModule)],
  providers: [SocketGateway, SocketService],
  exports: [SocketService, SocketGateway],
})
export class GatewayModule {}
