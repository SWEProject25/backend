import { Test, TestingModule } from '@nestjs/testing';
import { JwtTokenService } from './jwt-token.service';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';

describe('JwtTokenService', () => {
  let service: JwtTokenService;
  let jwtService: jest.Mocked<JwtService>;

  let mockJwtService = {
    signAsync: jest.fn(),
    sign: jest.fn(),
    verify: jest.fn(),
  };

  beforeEach(async () => {
    mockJwtService = {
      sign: jest.fn(),
      signAsync: jest.fn(),
      verify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtTokenService,
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<JwtTokenService>(JwtTokenService);
    jwtService = module.get(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('instantiation', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should have jwtService injected', () => {
      expect((service as any).jwtService).toBeDefined();
      expect((service as any).jwtService).toBe(jwtService);
    });
  });

  describe('generateAccessToken', () => {
    it('should generate access token with valid payload', async () => {
      const userId = 1;
      const username = 'testuser';
      const mockToken = 'mock.jwt.token';

      jwtService.signAsync.mockResolvedValue(mockToken);

      const result = await service.generateAccessToken(userId, username);

      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: userId,
        username: username,
      });
      expect(result).toBe(mockToken);
    });

    it('should handle different user IDs', async () => {
      const testCases = [
        { userId: 1, username: 'user1', token: 'token1' },
        { userId: 999, username: 'user999', token: 'token999' },
        { userId: 123456, username: 'longuser', token: 'tokenlong' },
      ];

      for (const testCase of testCases) {
        jwtService.signAsync.mockResolvedValue(testCase.token);

        const result = await service.generateAccessToken(testCase.userId, testCase.username);

        expect(jwtService.signAsync).toHaveBeenCalledWith({
          sub: testCase.userId,
          username: testCase.username,
        });
        expect(result).toBe(testCase.token);
      }
    });

    it('should handle different usernames', async () => {
      const userId = 1;
      const usernames = ['simple', 'user.name', 'user-name', 'user_name', 'user123'];

      for (const username of usernames) {
        const mockToken = `token-for-${username}`;
        jwtService.signAsync.mockResolvedValue(mockToken);

        const result = await service.generateAccessToken(userId, username);

        expect(jwtService.signAsync).toHaveBeenCalledWith({
          sub: userId,
          username: username,
        });
        expect(result).toBe(mockToken);
      }
    });

    it('should handle special characters in username', async () => {
      const userId = 1;
      const specialUsernames = ['user@example', 'user+tag', 'user#hash', 'user spaces', 'üser'];

      for (const username of specialUsernames) {
        const mockToken = `token-special`;
        jwtService.signAsync.mockResolvedValue(mockToken);

        const result = await service.generateAccessToken(userId, username);

        expect(jwtService.signAsync).toHaveBeenCalledWith({
          sub: userId,
          username: username,
        });
        expect(result).toBe(mockToken);
      }
    });

    it('should handle very long usernames', async () => {
      const userId = 1;
      const longUsername = 'a'.repeat(1000);
      const mockToken = 'long-token';

      jwtService.signAsync.mockResolvedValue(mockToken);

      const result = await service.generateAccessToken(userId, longUsername);

      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: userId,
        username: longUsername,
      });
      expect(result).toBe(mockToken);
    });

    it('should propagate JWT service errors', async () => {
      const userId = 1;
      const username = 'testuser';
      const error = new Error('JWT signing failed');

      jwtService.signAsync.mockRejectedValue(error);

      await expect(service.generateAccessToken(userId, username)).rejects.toThrow(
        'JWT signing failed',
      );
    });

    it('should handle JWT service returning undefined', async () => {
      const userId = 1;
      const username = 'testuser';

      jwtService.signAsync.mockResolvedValue(undefined as any);

      const result = await service.generateAccessToken(userId, username);

      expect(result).toBeUndefined();
    });

    it('should handle JWT service returning empty string', async () => {
      const userId = 1;
      const username = 'testuser';

      jwtService.signAsync.mockResolvedValue('');

      const result = await service.generateAccessToken(userId, username);

      expect(result).toBe('');
    });

    it('should handle zero as userId', async () => {
      const userId = 0;
      const username = 'zerouser';
      const mockToken = 'zero-token';

      jwtService.signAsync.mockResolvedValue(mockToken);

      const result = await service.generateAccessToken(userId, username);

      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: 0,
        username: username,
      });
      expect(result).toBe(mockToken);
    });

    it('should handle negative userId', async () => {
      const userId = -1;
      const username = 'negativeuser';
      const mockToken = 'negative-token';

      jwtService.signAsync.mockResolvedValue(mockToken);

      const result = await service.generateAccessToken(userId, username);

      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: -1,
        username: username,
      });
      expect(result).toBe(mockToken);
    });

    it('should handle empty username', async () => {
      const userId = 1;
      const username = '';
      const mockToken = 'empty-username-token';

      jwtService.signAsync.mockResolvedValue(mockToken);

      const result = await service.generateAccessToken(userId, username);

      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: userId,
        username: '',
      });
      expect(result).toBe(mockToken);
    });
  });

  describe('setAuthCookies', () => {
    let mockResponse: Partial<Response>;

    beforeEach(() => {
      mockResponse = {
        cookie: jest.fn(),
      };
    });

    it('should set access token cookie with correct options', () => {
      const accessToken = 'test-access-token';
      const originalEnv = process.env.JWT_EXPIRES_IN;
      process.env.JWT_EXPIRES_IN = '1h';

      service.setAuthCookies(mockResponse as Response, accessToken);

      expect(mockResponse.cookie).toHaveBeenCalledWith('access_token', accessToken, {
        httpOnly: true,
        sameSite: 'none',
        secure: true,
        maxAge: 3600000, // 1 hour in milliseconds
        path: '/',
      });

      process.env.JWT_EXPIRES_IN = originalEnv;
    });

    it('should use default expiry when JWT_EXPIRES_IN is not set', () => {
      const accessToken = 'test-access-token';
      const originalEnv = process.env.JWT_EXPIRES_IN;
      delete process.env.JWT_EXPIRES_IN;

      service.setAuthCookies(mockResponse as Response, accessToken);

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'access_token',
        accessToken,
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'none',
          secure: true,
          maxAge: 3600000, // Default 1h
          path: '/',
        }),
      );

      process.env.JWT_EXPIRES_IN = originalEnv;
    });

    it('should handle different JWT_EXPIRES_IN values', () => {
      const accessToken = 'test-token';
      const testCases = [
        { expiresIn: '30m', expectedMaxAge: 1800000 },
        { expiresIn: '2h', expectedMaxAge: 7200000 },
        { expiresIn: '1d', expectedMaxAge: 86400000 },
        { expiresIn: '7d', expectedMaxAge: 604800000 },
      ];

      for (const testCase of testCases) {
        process.env.JWT_EXPIRES_IN = testCase.expiresIn;

        service.setAuthCookies(mockResponse as Response, accessToken);

        expect(mockResponse.cookie).toHaveBeenCalledWith(
          'access_token',
          accessToken,
          expect.objectContaining({
            maxAge: testCase.expectedMaxAge,
          }),
        );
      }
    });

    it('should set cookies with secure flag', () => {
      const accessToken = 'test-token';

      service.setAuthCookies(mockResponse as Response, accessToken);

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'access_token',
        accessToken,
        expect.objectContaining({
          secure: true,
        }),
      );
    });

    it('should set cookies with httpOnly flag', () => {
      const accessToken = 'test-token';

      service.setAuthCookies(mockResponse as Response, accessToken);

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'access_token',
        accessToken,
        expect.objectContaining({
          httpOnly: true,
        }),
      );
    });

    it('should set cookies with sameSite none', () => {
      const accessToken = 'test-token';

      service.setAuthCookies(mockResponse as Response, accessToken);

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'access_token',
        accessToken,
        expect.objectContaining({
          sameSite: 'none',
        }),
      );
    });

    it('should set cookies with root path', () => {
      const accessToken = 'test-token';

      service.setAuthCookies(mockResponse as Response, accessToken);

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'access_token',
        accessToken,
        expect.objectContaining({
          path: '/',
        }),
      );
    });

    it('should handle empty access token', () => {
      const accessToken = '';

      service.setAuthCookies(mockResponse as Response, accessToken);

      expect(mockResponse.cookie).toHaveBeenCalledWith('access_token', '', expect.any(Object));
    });

    it('should handle very long access token', () => {
      const accessToken = 'a'.repeat(10000);

      service.setAuthCookies(mockResponse as Response, accessToken);

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'access_token',
        accessToken,
        expect.any(Object),
      );
    });

    it('should handle special characters in token', () => {
      const accessToken = 'token.with.dots+and=equals&and?special!chars';

      service.setAuthCookies(mockResponse as Response, accessToken);

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'access_token',
        accessToken,
        expect.any(Object),
      );
    });

    it('should call cookie method exactly once', () => {
      const accessToken = 'test-token';

      service.setAuthCookies(mockResponse as Response, accessToken);

      expect(mockResponse.cookie).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearAuthCookies', () => {
    let mockResponse: Partial<Response>;

    beforeEach(() => {
      mockResponse = {
        clearCookie: jest.fn(),
      };
    });

    it('should clear access token cookie', () => {
      service.clearAuthCookies(mockResponse as Response);

      expect(mockResponse.clearCookie).toHaveBeenCalledWith('access_token', { path: '/' });
    });

    it('should clear cookie with root path', () => {
      service.clearAuthCookies(mockResponse as Response);

      expect(mockResponse.clearCookie).toHaveBeenCalledWith(
        'access_token',
        expect.objectContaining({
          path: '/',
        }),
      );
    });

    it('should call clearCookie exactly once', () => {
      service.clearAuthCookies(mockResponse as Response);

      expect(mockResponse.clearCookie).toHaveBeenCalledTimes(1);
    });

    it('should clear correct cookie name', () => {
      service.clearAuthCookies(mockResponse as Response);

      expect(mockResponse.clearCookie).toHaveBeenCalledWith('access_token', expect.any(Object));
    });

    it('should handle multiple calls to clearAuthCookies', () => {
      service.clearAuthCookies(mockResponse as Response);
      service.clearAuthCookies(mockResponse as Response);
      service.clearAuthCookies(mockResponse as Response);

      expect(mockResponse.clearCookie).toHaveBeenCalledTimes(3);
    });

    it('should work with different response objects', () => {
      const response1 = { clearCookie: jest.fn() };
      const response2 = { clearCookie: jest.fn() };
      const response3 = { clearCookie: jest.fn() };

      service.clearAuthCookies(response1 as any);
      service.clearAuthCookies(response2 as any);
      service.clearAuthCookies(response3 as any);

      expect(response1.clearCookie).toHaveBeenCalledTimes(1);
      expect(response2.clearCookie).toHaveBeenCalledTimes(1);
      expect(response3.clearCookie).toHaveBeenCalledTimes(1);
    });
  });

  describe('edge cases', () => {
    it('should handle concurrent generateAccessToken calls', async () => {
      const userId = 1;
      const username = 'testuser';
      const mockToken = 'concurrent-token';

      jwtService.signAsync.mockResolvedValue(mockToken);

      const promises = Array.from({ length: 10 }, () =>
        service.generateAccessToken(userId, username),
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach((result) => {
        expect(result).toBe(mockToken);
      });
      expect(jwtService.signAsync).toHaveBeenCalledTimes(10);
    });

    it('should maintain state across multiple cookie operations', () => {
      const mockResponse = {
        cookie: jest.fn(),
        clearCookie: jest.fn(),
      };

      service.setAuthCookies(mockResponse as any, 'token1');
      service.clearAuthCookies(mockResponse as any);
      service.setAuthCookies(mockResponse as any, 'token2');

      expect(mockResponse.cookie).toHaveBeenCalledTimes(2);
      expect(mockResponse.clearCookie).toHaveBeenCalledTimes(1);
    });

    it('should handle JWT service timing variations', async () => {
      const userId = 1;
      const username = 'testuser';

      // Fast response
      jwtService.signAsync.mockResolvedValue('fast-token');
      const fastResult = await service.generateAccessToken(userId, username);
      expect(fastResult).toBe('fast-token');

      // Delayed response
      jwtService.signAsync.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve('slow-token'), 10)),
      );
      const slowResult = await service.generateAccessToken(userId, username);
      expect(slowResult).toBe('slow-token');
    });
  });

  describe('generateAccessToken', () => {
    it('should generate access token successfully', async () => {
      const userId = 1;
      const username = 'testuser';
      const expectedToken = 'mock.jwt.token';

      mockJwtService.signAsync.mockResolvedValue(expectedToken);

      const result = await service.generateAccessToken(userId, username);

      expect(result).toBe(expectedToken);
      expect(mockJwtService.signAsync).toHaveBeenCalledWith({
        sub: userId,
        username,
      });
    });
  });

  describe('setAuthCookies', () => {
    it('should set auth cookie with correct options', () => {
      const mockResponse = {
        cookie: jest.fn(),
      } as unknown as Response;

      const accessToken = 'mock.jwt.token';

      service.setAuthCookies(mockResponse, accessToken);

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'access_token',
        accessToken,
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'none',
          secure: true,
          path: '/',
        }),
      );
    });
  });

  describe('clearAuthCookies', () => {
    it('should clear auth cookie', () => {
      const mockResponse = {
        clearCookie: jest.fn(),
      } as unknown as Response;

      service.clearAuthCookies(mockResponse);

      expect(mockResponse.clearCookie).toHaveBeenCalledWith('access_token', {
        path: '/',
      });
    });
  });
});
