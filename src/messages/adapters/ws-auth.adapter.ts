import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthenticatedSocketAdapter extends IoAdapter {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, options);

    server.use(async (socket, next) => {
      try {
        // Extract token from cookies
        const cookies = socket.handshake.headers.cookie;
        
        if (!cookies) {
          return next(new Error('Authentication cookie not provided'));
        }

        // Parse cookies to find access_token
        const cookieArray = cookies.split(';').map(cookie => cookie.trim());
        const accessTokenCookie = cookieArray.find(cookie => cookie.startsWith('access_token='));
        
        if (!accessTokenCookie) {
          return next(new Error('Access token not found in cookies'));
        }

        const token = accessTokenCookie.split('=')[1];

        // Verify the token
        const payload = await this.jwtService.verifyAsync(token, {
          secret: this.configService.get<string>('JWT_SECRET'),
        });

        // Attach user info to socket
        socket.data.userId = payload.sub;
        socket.data.username = payload.username;

        next();
      } catch (error) {
        next(new Error('Invalid authentication token'));
      }
    });

    return server;
  }
}
