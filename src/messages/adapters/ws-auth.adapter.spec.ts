// The AuthenticatedSocketAdapter extends IoAdapter which requires an HTTP server
// to create a Socket.IO server. This makes it challenging to unit test in isolation.
// The middleware logic is the core authentication functionality.

import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Socket } from 'socket.io';

// Since ws-auth.adapter.ts extends IoAdapter and the createIOServer method
// depends on super.createIOServer(), we need to mock the parent class behavior.
// Jest hoists jest.mock calls, so the mock must be defined before any module imports.

const mockServerUse = jest.fn();

jest.mock('@nestjs/platform-socket.io', () => ({
  IoAdapter: class MockIoAdapter {
    createIOServer(port: number, options?: any) {
      return {
        use: mockServerUse,
      };
    }
  },
}));

// Import after mocks are set up
import { AuthenticatedSocketAdapter } from './ws-auth.adapter';

describe('AuthenticatedSocketAdapter', () => {
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;
  let adapter: AuthenticatedSocketAdapter;

  beforeEach(() => {
    jest.clearAllMocks();

    jwtService = {
      verifyAsync: jest.fn(),
    } as any;

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'FRONTEND_URL') return 'https://frontend.example.com';
        if (key === 'JWT_SECRET') return 'test-secret';
        return undefined;
      }),
    } as any;

    adapter = new AuthenticatedSocketAdapter(jwtService, configService);
  });

  describe('constructor', () => {
    it('should create adapter instance', () => {
      expect(adapter).toBeDefined();
      expect(adapter).toBeInstanceOf(AuthenticatedSocketAdapter);
    });
  });

  describe('createIOServer', () => {
    it('should create server and return it', () => {
      const server = adapter.createIOServer(8000);

      expect(server).toBeDefined();
      expect(server.use).toBeDefined();
    });

    it('should register authentication middleware', () => {
      adapter.createIOServer(8000);

      expect(mockServerUse).toHaveBeenCalledTimes(1);
      expect(mockServerUse).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should pass server options', () => {
      const options = { pingTimeout: 5000 };
      const server = adapter.createIOServer(8000, options as any);

      expect(server).toBeDefined();
    });
  });

  describe('authentication middleware', () => {
    let middleware: (socket: Socket, next: (err?: Error) => void) => Promise<void>;
    let mockSocket: Partial<Socket>;
    let nextFn: jest.Mock;

    beforeEach(() => {
      adapter.createIOServer(8000);
      middleware = mockServerUse.mock.calls[0][0];

      mockSocket = {
        handshake: {
          headers: {},
        } as any,
        data: {},
      };

      nextFn = jest.fn();
    });

    it('should call next with error if no cookies provided', async () => {
      mockSocket.handshake!.headers = {};

      await middleware(mockSocket as Socket, nextFn);

      expect(nextFn).toHaveBeenCalledWith(expect.any(Error));
      expect(nextFn.mock.calls[0][0].message).toBe('Authentication cookie not provided');
    });

    it('should call next with error if access_token not in cookies', async () => {
      mockSocket.handshake!.headers.cookie = 'other_cookie=value';

      await middleware(mockSocket as Socket, nextFn);

      expect(nextFn).toHaveBeenCalledWith(expect.any(Error));
      expect(nextFn.mock.calls[0][0].message).toBe('Access token not found in cookies');
    });

    it('should authenticate successfully with valid token', async () => {
      mockSocket.handshake!.headers.cookie = 'access_token=valid-jwt-token';

      jwtService.verifyAsync.mockResolvedValue({
        sub: 123,
        username: 'testuser',
      });

      await middleware(mockSocket as Socket, nextFn);

      expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid-jwt-token', {
        secret: 'test-secret',
      });
      expect(mockSocket.data!.userId).toBe(123);
      expect(mockSocket.data!.username).toBe('testuser');
      expect(nextFn).toHaveBeenCalledWith();
    });

    it('should handle multiple cookies and extract access_token', async () => {
      mockSocket.handshake!.headers.cookie =
        'session=abc123; access_token=my-jwt-token; other=value';

      jwtService.verifyAsync.mockResolvedValue({
        sub: 456,
        username: 'anotheruser',
      });

      await middleware(mockSocket as Socket, nextFn);

      expect(jwtService.verifyAsync).toHaveBeenCalledWith('my-jwt-token', {
        secret: 'test-secret',
      });
      expect(mockSocket.data!.userId).toBe(456);
    });

    it('should call next with error on invalid token', async () => {
      mockSocket.handshake!.headers.cookie = 'access_token=invalid-token';

      jwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));

      await middleware(mockSocket as Socket, nextFn);

      expect(nextFn).toHaveBeenCalledWith(expect.any(Error));
      expect(nextFn.mock.calls[0][0].message).toBe('Invalid authentication token');
    });

    it('should call next with error on expired token', async () => {
      mockSocket.handshake!.headers.cookie = 'access_token=expired-token';

      jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

      await middleware(mockSocket as Socket, nextFn);

      expect(nextFn).toHaveBeenCalledWith(expect.any(Error));
      expect(nextFn.mock.calls[0][0].message).toBe('Invalid authentication token');
    });

    it('should handle cookie with spaces properly', async () => {
      mockSocket.handshake!.headers.cookie = '  access_token=token-with-spaces  ; other=val  ';

      jwtService.verifyAsync.mockResolvedValue({
        sub: 789,
        username: 'user',
      });

      await middleware(mockSocket as Socket, nextFn);

      expect(jwtService.verifyAsync).toHaveBeenCalledWith('token-with-spaces', {
        secret: 'test-secret',
      });
    });
  });
});
