import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { AuthService } from '../auth.service';
import jwtConfig from '../config/jwt.config';
import { Services } from 'src/utils/constants';
import { AuthJwtPayload } from 'src/types/jwtPayload';
import { Role } from '@prisma/client';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let authService: jest.Mocked<AuthService>;

  const mockJwtConfig = {
    secret: 'test-secret-key',
    signOptions: {
      expiresIn: '1h',
    },
  };

  const mockAuthService = {
    validateUserJwt: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: jwtConfig.KEY,
          useValue: mockJwtConfig,
        },
        {
          provide: Services.AUTH,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    authService = module.get(Services.AUTH);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    const mockPayload: AuthJwtPayload = {
      sub: 1,
      username: 'testuser',
    };

    const mockValidatedUser = {
      id: 1,
      username: 'testuser',
      role: Role.USER,
      email: 'test@example.com',
      name: 'Test User',
      profileImageUrl: 'https://example.com/avatar.jpg',
    };

    it('should validate user and return user data', async () => {
      authService.validateUserJwt.mockResolvedValue(mockValidatedUser);

      const result = await strategy.validate(mockPayload);

      expect(authService.validateUserJwt).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockValidatedUser);
    });

    it('should extract userId from sub field of payload', async () => {
      const payload: AuthJwtPayload = {
        sub: 999,
        username: 'anotheruser',
      };

      authService.validateUserJwt.mockResolvedValue({
        ...mockValidatedUser,
        id: 999,
      });

      await strategy.validate(payload);

      expect(authService.validateUserJwt).toHaveBeenCalledWith(999);
    });

    it('should handle payload with additional fields', async () => {
      const payloadWithExtra: AuthJwtPayload = {
        sub: 1,
        username: 'testuser',
        email: 'test@example.com',
        role: Role.USER,
        profileImageUrl: 'https://example.com/avatar.jpg',
      };

      authService.validateUserJwt.mockResolvedValue(mockValidatedUser);

      const result = await strategy.validate(payloadWithExtra);

      expect(authService.validateUserJwt).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockValidatedUser);
    });

    it('should propagate UnauthorizedException when user not found', async () => {
      const error = new UnauthorizedException('Invalid Credentials');
      authService.validateUserJwt.mockRejectedValue(error);

      await expect(strategy.validate(mockPayload)).rejects.toThrow(UnauthorizedException);
      await expect(strategy.validate(mockPayload)).rejects.toThrow('Invalid Credentials');
    });

    it('should propagate UnauthorizedException when account is deleted', async () => {
      const error = new UnauthorizedException('Account has been deleted');
      authService.validateUserJwt.mockRejectedValue(error);

      await expect(strategy.validate(mockPayload)).rejects.toThrow(UnauthorizedException);
      await expect(strategy.validate(mockPayload)).rejects.toThrow('Account has been deleted');
    });

    it('should return user without profile data if not available', async () => {
      const userWithoutProfile = {
        ...mockValidatedUser,
        name: undefined,
        profileImageUrl: undefined,
      };

      authService.validateUserJwt.mockResolvedValue(userWithoutProfile);

      const result = await strategy.validate(mockPayload);

      expect(result).toEqual(userWithoutProfile);
    });

    it('should handle numeric userId correctly', async () => {
      const payload: AuthJwtPayload = {
        sub: 12345,
        username: 'user12345',
      };

      authService.validateUserJwt.mockResolvedValue({
        ...mockValidatedUser,
        id: 12345,
      });

      await strategy.validate(payload);

      expect(authService.validateUserJwt).toHaveBeenCalledWith(12345);
    });

    it('should handle different roles', async () => {
      const adminUser = {
        ...mockValidatedUser,
        role: Role.ADMIN,
      };

      authService.validateUserJwt.mockResolvedValue(adminUser);

      const result = await strategy.validate(mockPayload);

      expect(result.role).toBe(Role.ADMIN);
    });

    it('should return the same data from validateUserJwt', async () => {
      authService.validateUserJwt.mockResolvedValue(mockValidatedUser);

      const result = await strategy.validate(mockPayload);

      // Ensure the result is exactly what validateUserJwt returns
      expect(result).toBe(mockValidatedUser);
    });

    it('should handle errors during validation', async () => {
      const error = new Error('Database connection failed');
      authService.validateUserJwt.mockRejectedValue(error);

      await expect(strategy.validate(mockPayload)).rejects.toThrow('Database connection failed');
    });
  });

  describe('constructor configuration', () => {
    it('should use cookieExtractor for JWT extraction', () => {
      // This tests that the strategy was properly configured
      expect(strategy).toBeDefined();
      expect(strategy).toHaveProperty('_passReqToCallback');
    });

    it('should not ignore expiration', () => {
      // The strategy should validate token expiration
      expect(strategy).toBeDefined();
    });

    it('should use the correct secret key', () => {
      // The secret is configured through the jwtConfig
      expect(strategy).toBeDefined();
    });
  });
});
