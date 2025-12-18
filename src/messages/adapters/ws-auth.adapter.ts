import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions, Socket } from 'socket.io';
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
    // Configure CORS for Socket.IO to match REST API configuration
    const allowedOrigins = [
      this.configService.get<string>('FRONTEND_URL') || 'https://hankers-frontend.myaddr.tools',
      'http://localhost:3000',
      'http://localhost:3001',
    ];

    const serverOptions: ServerOptions = {
      ...options,
      cors: {
        origin: allowedOrigins,
        credentials: true,
        methods: ['GET', 'POST'],
      },
    } as ServerOptions;

    const server = super.createIOServer(port, serverOptions);

    server.use(async (socket: Socket, next) => {
      try {
        // Extract token from cookies
        const cookies = socket.handshake.headers.cookie;

        if (!cookies) {
          return next(new Error('Authentication cookie not provided'));
        }

        // Parse cookies to find access_token
        const cookieArray = cookies.split(';').map((cookie) => cookie.trim());
        const accessTokenCookie = cookieArray.find((cookie) => cookie.startsWith('access_token='));

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
      } catch {
        next(new Error('Invalid authentication token'));
      }
    });

    return server;
  }
}
