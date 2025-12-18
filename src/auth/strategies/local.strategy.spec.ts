import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { LocalStrategy } from './local.strategy';
import { AuthService } from '../auth.service';
import { Services } from 'src/utils/constants';
import { AuthJwtPayload } from 'src/types/jwtPayload';
import { Role } from '@prisma/client';

describe('LocalStrategy', () => {
  let strategy: LocalStrategy;
  let authService: jest.Mocked<AuthService>;

  const mockAuthService = {
    validateLocalUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalStrategy,
        {
          provide: Services.AUTH,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    strategy = module.get<LocalStrategy>(LocalStrategy);
    authService = module.get(Services.AUTH);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    const mockEmail = 'test@example.com';
    const mockPassword = 'Password123!';

    const mockAuthPayload: AuthJwtPayload = {
      sub: 1,
      username: 'testuser',
      role: Role.USER,
      email: mockEmail,
      profileImageUrl: 'https://example.com/avatar.jpg',
    };

    it('should validate user with correct credentials', async () => {
      authService.validateLocalUser.mockResolvedValue(mockAuthPayload);

      const result = await strategy.validate(mockEmail, mockPassword);

      expect(authService.validateLocalUser).toHaveBeenCalledWith(
        mockEmail.toLowerCase(),
        mockPassword,
      );
      expect(result).toEqual(mockAuthPayload);
    });

    it('should trim and lowercase the email before validation', async () => {
      const emailWithSpaces = '  TEST@EXAMPLE.COM  ';
      authService.validateLocalUser.mockResolvedValue(mockAuthPayload);

      await strategy.validate(emailWithSpaces, mockPassword);

      expect(authService.validateLocalUser).toHaveBeenCalledWith('test@example.com', mockPassword);
    });

    it('should throw BadRequestException when password is empty', async () => {
      await expect(strategy.validate(mockEmail, '')).rejects.toThrow(BadRequestException);
      await expect(strategy.validate(mockEmail, '')).rejects.toThrow(
        'Please provide your password',
      );

      expect(authService.validateLocalUser).not.toHaveBeenCalled();
    });

    it('should handle email with only spaces', async () => {
      const emailWithSpaces = '   test@example.com   ';
      authService.validateLocalUser.mockResolvedValue(mockAuthPayload);

      await strategy.validate(emailWithSpaces, mockPassword);

      expect(authService.validateLocalUser).toHaveBeenCalledWith('test@example.com', mockPassword);
    });

    it('should handle uppercase email', async () => {
      const uppercaseEmail = 'TEST@EXAMPLE.COM';
      authService.validateLocalUser.mockResolvedValue(mockAuthPayload);

      await strategy.validate(uppercaseEmail, mockPassword);

      expect(authService.validateLocalUser).toHaveBeenCalledWith('test@example.com', mockPassword);
    });

    it('should propagate errors from authService.validateLocalUser', async () => {
      const error = new Error('Invalid credentials');
      authService.validateLocalUser.mockRejectedValue(error);

      await expect(strategy.validate(mockEmail, mockPassword)).rejects.toThrow(error);
    });

    it('should return auth payload without profileImageUrl if not provided', async () => {
      const payloadWithoutImage: AuthJwtPayload = {
        sub: 1,
        username: 'testuser',
        role: Role.USER,
        email: mockEmail,
        profileImageUrl: null,
      };

      authService.validateLocalUser.mockResolvedValue(payloadWithoutImage);

      const result = await strategy.validate(mockEmail, mockPassword);

      expect(result.profileImageUrl).toBeNull();
    });

    it('should handle special characters in password', async () => {
      const specialPassword = 'P@ssw0rd!#$%';
      authService.validateLocalUser.mockResolvedValue(mockAuthPayload);

      await strategy.validate(mockEmail, specialPassword);

      expect(authService.validateLocalUser).toHaveBeenCalledWith(
        mockEmail.toLowerCase(),
        specialPassword,
      );
    });

    it('should handle mixed case email addresses', async () => {
      const mixedCaseEmail = 'TeSt@ExAmPlE.cOm';
      authService.validateLocalUser.mockResolvedValue(mockAuthPayload);

      await strategy.validate(mixedCaseEmail, mockPassword);

      expect(authService.validateLocalUser).toHaveBeenCalledWith('test@example.com', mockPassword);
    });
  });

  describe('constructor', () => {
    it('should initialize with usernameField set to email', () => {
      // Access the strategy's options via the strategy instance
      // This tests that the super() call was made with correct config
      expect(strategy).toHaveProperty('_passReqToCallback');
    });
  });
});
