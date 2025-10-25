import { Catch, ArgumentsHost } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Catch()
export class WebSocketExceptionFilter extends BaseWsExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const client = host.switchToWs().getClient<Socket>();
    const error = exception instanceof WsException ? exception.getError() : exception;

    const errorResponse = {
      status: 'error',
      message: this.getErrorMessage(error),
      timestamp: new Date().toISOString(),
    };

    client.emit('error', errorResponse);
  }

  private getErrorMessage(error: any): string {
    if (typeof error === 'string') {
      return error;
    }
    if (error?.message) {
      return error.message;
    }
    return 'An unexpected error occurred';
  }
}
