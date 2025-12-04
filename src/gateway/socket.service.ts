import { Injectable } from '@nestjs/common';
import { SocketGateway } from './socket.gateway';

@Injectable()
export class SocketService {
  constructor(private readonly socketGateway: SocketGateway) {}

  emitPostStatsUpdate(
    postId: number,
    eventName: 'likeUpdate' | 'repostUpdate' | 'commentUpdate',
    count: number,
  ) {
    this.socketGateway.emitPostStatsUpdate(postId, eventName, count);
  }
}
