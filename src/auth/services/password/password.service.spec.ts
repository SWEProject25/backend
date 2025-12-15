import { Test, TestingModule } from '@nestjs/testing';
import { PasswordService } from './password.service';
import { Services } from 'src/utils/constants';
import { UserService } from 'src/user/user.service';
import { EmailService } from 'src/email/email.service';
import { RedisService } from 'src/redis/redis.service';
import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { RequestType } from 'src/utils/constants';

describe('PasswordService', () => {
  let service: PasswordService;
  let userService: jest.Mocked<UserService>;
  let emailService: jest.Mocked<EmailService>;
  let redisService: jest.Mocked<RedisService>;

  const mockUser = {
    id: 1,
    email: 'test@example.com',
    username: 'testuser',
    password: 'hashedPassword123',
  };

  const mockUserService = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    updatePassword: jest.fn(),
  };

  const mockEmailService = {
    queueTemplateEmail: jest.fn(),
  };

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordService,
        {
          provide: Services.USER,
          useValue: mockUserService,
        },
        {
          provide: Services.EMAIL,
          useValue: mockEmailService,
        },
        {
          provide: Services.REDIS,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<PasswordService>(PasswordService);
    userService = module.get(Services.USER);
    emailService = module.get(Services.EMAIL);
    redisService = module.get(Services.REDIS);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('instantiation', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should have all dependencies injected', () => {
      expect(userService).toBeDefined();
      expect(emailService).toBeDefined();
      expect(redisService).toBeDefined();
    });
  });

  describe('hash', () => {
    it('should hash a password', async () => {
      const password = 'myPassword123';
      const hashed = await service.hash(password);

      expect(hashed).toBeDefined();
      expect(hashed).not.toBe(password);
      expect(hashed.length).toBeGreaterThan(0);
    });

    it('should produce different hashes for same password', async () => {
      const password = 'myPassword123';
      const hash1 = await service.hash(password);
      const hash2 = await service.hash(password);

      expect(hash1).not.toBe(hash2); // Argon2 uses random salts
    });

    it('should handle empty strings', async () => {
      const hash = await service.hash('');
      expect(hash).toBeDefined();
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should handle long passwords', async () => {
      const longPassword = 'a'.repeat(1000);
      const hash = await service.hash(longPassword);
      expect(hash).toBeDefined();
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should handle special characters', async () => {
      const specialPassword = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const hash = await service.hash(specialPassword);
      expect(hash).toBeDefined();
      expect(hash.length).toBeGreaterThan(0);
    });
  });

  describe('verify', () => {
    it('should verify correct password', async () => {
      const password = 'myPassword123';
      const hashed = await argon2.hash(password);

      const result = await service.verify(hashed, password);
      expect(result).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'myPassword123';
      const wrongPassword = 'wrongPassword';
      const hashed = await argon2.hash(password);

      const result = await service.verify(hashed, wrongPassword);
      expect(result).toBe(false);
    });

    it('should return false for invalid hash', async () => {
      const result = await service.verify('invalidHash', 'password');
      expect(result).toBe(false);
    });

    it('should handle empty password', async () => {
      const hash = await argon2.hash('password');
      const result = await service.verify(hash, '');
      expect(result).toBe(false);
    });

    it('should handle empty hash', async () => {
      const result = await service.verify('', 'password');
      expect(result).toBe(false);
    });

    it('should handle verification errors gracefully', async () => {
      // Use a malformed hash to trigger an error
      const result = await service.verify('not-a-valid-argon2-hash', 'password');
      expect(result).toBe(false);
    });
  });

  describe('requestPasswordReset', () => {
    const requestDto = {
      email: 'test@example.com',
      type: RequestType.WEB,
    };

    beforeEach(() => {
      userService.findByEmail.mockResolvedValue(mockUser as any);
      redisService.get.mockResolvedValue(null);
      redisService.set.mockResolvedValue(undefined);
      emailService.queueTemplateEmail.mockResolvedValue(undefined as any);
    });

    it('should successfully request password reset', async () => {
      await service.requestPasswordReset(requestDto);

      expect(userService.findByEmail).toHaveBeenCalledWith(requestDto.email);
      expect(emailService.queueTemplateEmail).toHaveBeenCalled();
      // Should set 3 keys: reset token, attempts counter, and cooldown
      expect(redisService.set).toHaveBeenCalledTimes(3);
    });

    it('should throw BadRequestException when in cooldown period', async () => {
      redisService.get.mockResolvedValue('true'); // Cooldown exists

      await expect(service.requestPasswordReset(requestDto)).rejects.toThrow(BadRequestException);
      await expect(service.requestPasswordReset(requestDto)).rejects.toThrow(
        'Please wait 60 seconds before requesting another password reset.',
      );

      expect(userService.findByEmail).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent user', async () => {
      userService.findByEmail.mockResolvedValue(null);

      await expect(service.requestPasswordReset(requestDto)).rejects.toThrow(NotFoundException);
      await expect(service.requestPasswordReset(requestDto)).rejects.toThrow('Invalid email');
    });

    it('should throw BadRequestException when max attempts reached', async () => {
      redisService.get
        .mockResolvedValueOnce(null) // No cooldown first check
        .mockResolvedValueOnce('5'); // Max attempts reached

      await expect(service.requestPasswordReset(requestDto)).rejects.toThrow(BadRequestException);

      // Reset mocks for second expect
      redisService.get
        .mockResolvedValueOnce(null) // No cooldown first check
        .mockResolvedValueOnce('5'); // Max attempts reached

      await expect(service.requestPasswordReset(requestDto)).rejects.toThrow(
        'Too many password reset requests. Please try again later.',
      );
    });

    it('should generate correct reset URL for browser', async () => {
      process.env.NODE_ENV = 'dev';
      process.env.FRONTEND_URL = 'http://localhost:3000';

      await service.requestPasswordReset(requestDto);

      const emailCall = emailService.queueTemplateEmail.mock.calls[0];
      const context = emailCall[3];
      expect(context.verificationCode).toContain('http://localhost:3000/reset-password');
      expect(context.verificationCode).toContain('token=');
      expect(context.verificationCode).toContain('id=1');
    });

    it('should generate correct reset URL for mobile', async () => {
      const mobileRequestDto = {
        email: 'test@example.com',
        type: RequestType.MOBILE,
      };
      process.env.NODE_ENV = 'dev';
      process.env.BACKEND_URL_DEV = 'http://localhost:4000';
      process.env.APP_VERSION = 'v1';

      await service.requestPasswordReset(mobileRequestDto);

      const emailCall = emailService.queueTemplateEmail.mock.calls[0];
      const context = emailCall[3];
      expect(context.verificationCode).toContain(
        'http://localhost:4000/api/v1/auth/reset-mobile-password',
      );
      expect(context.verificationCode).toContain('token=');
      expect(context.verificationCode).toContain('id=1');
    });

    it('should send email with correct template and context', async () => {
      await service.requestPasswordReset(requestDto);

      expect(emailService.queueTemplateEmail).toHaveBeenCalledWith(
        [requestDto.email],
        'Password Reset Request',
        'reset-password.html',
        expect.objectContaining({
          verificationCode: expect.any(String),
          username: mockUser.username,
        }),
      );
    });

    it('should increment reset attempts', async () => {
      await service.requestPasswordReset(requestDto);

      const setCallsForAttempts = redisService.set.mock.calls.filter((call) =>
        call[0].includes('reset-attempts:'),
      );
      expect(setCallsForAttempts.length).toBeGreaterThan(0);
    });

    it('should set cooldown after request', async () => {
      await service.requestPasswordReset(requestDto);

      const setCalls = redisService.set.mock.calls;
      const cooldownCall = setCalls.find((call) => call[0].includes('cooldown:password-reset:'));
      expect(cooldownCall).toBeDefined();
      expect(cooldownCall![1]).toBe('true');
      expect(cooldownCall![2]).toBe(60); // 1 minute cooldown
    });

    it('should handle second attempt within window', async () => {
      redisService.get
        .mockResolvedValueOnce(null) // No cooldown check
        .mockResolvedValueOnce('1') // 1 attempt exists (for checkResetAttempts)
        .mockResolvedValueOnce('1'); // Read current count in incrementResetAttempts

      await service.requestPasswordReset(requestDto);

      const setCallsForAttempts = redisService.set.mock.calls.filter(
        (call) => call[0].includes('reset-attempts:') && call[1] === '2',
      );
      expect(setCallsForAttempts.length).toBe(1);
    });
  });

  describe('verifyResetToken', () => {
    const userId = 1;
    const resetToken = 'validToken123';
    let tokenHash: string;

    beforeEach(() => {
      tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
      redisService.get.mockResolvedValue(tokenHash);
      redisService.set.mockResolvedValue(undefined);
    });

    it('should verify valid reset token', async () => {
      const result = await service.verifyResetToken(userId, resetToken);
      expect(result).toBe(true);
      expect(redisService.get).toHaveBeenCalledWith(`password-reset:${userId}`);
    });

    it('should verify test token', async () => {
      const result = await service.verifyResetToken(userId, 'testToken');
      expect(result).toBe(true);
      // Should store the test token hash
      expect(redisService.set).toHaveBeenCalled();
    });

    it('should throw BadRequestException when userId is missing', async () => {
      await expect(service.verifyResetToken(null as any, resetToken)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.verifyResetToken(null as any, resetToken)).rejects.toThrow(
        'User ID and token are required',
      );
    });

    it('should throw BadRequestException when token is missing', async () => {
      await expect(service.verifyResetToken(userId, '')).rejects.toThrow(BadRequestException);
    });

    it('should throw UnauthorizedException when token not found in Redis', async () => {
      redisService.get.mockResolvedValue(null);

      await expect(service.verifyResetToken(userId, resetToken)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.verifyResetToken(userId, resetToken)).rejects.toThrow(
        'Password reset token is invalid or has expired',
      );
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      const wrongToken = 'wrongToken';

      await expect(service.verifyResetToken(userId, wrongToken)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.verifyResetToken(userId, wrongToken)).rejects.toThrow(
        'Invalid password reset token',
      );
    });

    it('should handle token hash comparison correctly', async () => {
      const token1 = 'token1';
      const token2 = 'token2';
      const hash1 = crypto.createHash('sha256').update(token1).digest('hex');

      redisService.get.mockResolvedValue(hash1);

      await expect(service.verifyResetToken(userId, token1)).resolves.toBe(true);
      await expect(service.verifyResetToken(userId, token2)).rejects.toThrow();
    });

    it('should validate token for different user IDs independently', async () => {
      const userId1 = 1;
      const userId2 = 2;

      await expect(service.verifyResetToken(userId1, resetToken)).resolves.toBe(true);
      expect(redisService.get).toHaveBeenCalledWith(`password-reset:${userId1}`);

      await expect(service.verifyResetToken(userId2, resetToken)).resolves.toBe(true);
      expect(redisService.get).toHaveBeenCalledWith(`password-reset:${userId2}`);
    });
  });

  describe('resetPassword', () => {
    const userId = 1;
    const newPassword = 'newPassword123';
    const tokenHash = 'validTokenHash';

    beforeEach(() => {
      redisService.get.mockResolvedValue(tokenHash);
      redisService.del.mockResolvedValue(1);
      userService.findById.mockResolvedValue(mockUser as any);
      userService.updatePassword.mockResolvedValue(undefined as any);
    });

    it('should reset password successfully', async () => {
      await service.resetPassword(userId, newPassword);

      expect(redisService.get).toHaveBeenCalledWith(`password-reset:${userId}`);
      expect(userService.findById).toHaveBeenCalledWith(userId);
      expect(userService.updatePassword).toHaveBeenCalledWith(userId, expect.any(String));
      expect(redisService.del).toHaveBeenCalledWith(`password-reset:${userId}`);
    });

    it('should throw UnauthorizedException when token not found', async () => {
      redisService.get.mockResolvedValue(null);

      await expect(service.resetPassword(userId, newPassword)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.resetPassword(userId, newPassword)).rejects.toThrow(
        'Password reset token is invalid or has expired',
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      userService.findById.mockResolvedValue(null);

      await expect(service.resetPassword(userId, newPassword)).rejects.toThrow(NotFoundException);
      await expect(service.resetPassword(userId, newPassword)).rejects.toThrow('User not found');
    });

    it('should hash new password before updating', async () => {
      await service.resetPassword(userId, newPassword);

      const updateCall = userService.updatePassword.mock.calls[0];
      const hashedPassword = updateCall[1];

      expect(hashedPassword).not.toBe(newPassword);
      expect(hashedPassword.length).toBeGreaterThan(0);

      // Verify it's a valid argon2 hash
      const isValid = await argon2.verify(hashedPassword, newPassword);
      expect(isValid).toBe(true);
    });

    it('should delete reset token after successful reset', async () => {
      await service.resetPassword(userId, newPassword);

      expect(redisService.del).toHaveBeenCalledWith(`password-reset:${userId}`);
    });

    it('should handle different user IDs', async () => {
      const userId1 = 1;
      const userId2 = 2;

      await service.resetPassword(userId1, newPassword);
      await service.resetPassword(userId2, newPassword);

      expect(redisService.get).toHaveBeenCalledWith(`password-reset:${userId1}`);
      expect(redisService.get).toHaveBeenCalledWith(`password-reset:${userId2}`);
    });
  });

  describe('changePassword', () => {
    const userId = 1;
    const changePasswordDto = {
      oldPassword: 'oldPassword123',
      newPassword: 'newPassword123',
    };

    beforeEach(() => {
      userService.findById.mockResolvedValue(mockUser as any);
      userService.updatePassword.mockResolvedValue(undefined as any);
    });

    it('should change password successfully', async () => {
      const hashedOldPassword = await argon2.hash(changePasswordDto.oldPassword);
      userService.findById.mockResolvedValue({
        ...mockUser,
        password: hashedOldPassword,
      } as any);

      await service.changePassword(userId, changePasswordDto);

      expect(userService.findById).toHaveBeenCalledWith(userId);
      expect(userService.updatePassword).toHaveBeenCalledWith(userId, expect.any(String));
    });

    it('should throw UnauthorizedException when user not found', async () => {
      userService.findById.mockResolvedValue(null);

      await expect(service.changePassword(userId, changePasswordDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.changePassword(userId, changePasswordDto)).rejects.toThrow(
        'User not found',
      );
    });

    it('should throw BadRequestException for incorrect old password', async () => {
      const hashedPassword = await argon2.hash('differentPassword');
      userService.findById.mockResolvedValue({
        ...mockUser,
        password: hashedPassword,
      } as any);

      await expect(service.changePassword(userId, changePasswordDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.changePassword(userId, changePasswordDto)).rejects.toThrow(
        'Old password is incorrect',
      );
    });

    it('should throw BadRequestException when new password same as old', async () => {
      const password = 'samePassword123';
      const hashedPassword = await argon2.hash(password);
      userService.findById.mockResolvedValue({
        ...mockUser,
        password: hashedPassword,
      } as any);

      const samePasswordDto = {
        oldPassword: password,
        newPassword: password,
      };

      await expect(service.changePassword(userId, samePasswordDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.changePassword(userId, samePasswordDto)).rejects.toThrow(
        'New password must be different from old password',
      );
    });

    it('should hash new password before updating', async () => {
      const hashedOldPassword = await argon2.hash(changePasswordDto.oldPassword);
      userService.findById.mockResolvedValue({
        ...mockUser,
        password: hashedOldPassword,
      } as any);

      await service.changePassword(userId, changePasswordDto);

      const updateCall = userService.updatePassword.mock.calls[0];
      const hashedNewPassword = updateCall[1];

      expect(hashedNewPassword).not.toBe(changePasswordDto.newPassword);
      const isValid = await argon2.verify(hashedNewPassword, changePasswordDto.newPassword);
      expect(isValid).toBe(true);
    });

    it('should verify old password before allowing change', async () => {
      const hashedOldPassword = await argon2.hash(changePasswordDto.oldPassword);
      userService.findById.mockResolvedValue({
        ...mockUser,
        password: hashedOldPassword,
      } as any);

      await service.changePassword(userId, changePasswordDto);

      expect(userService.updatePassword).toHaveBeenCalled();
    });
  });

  describe('verifyCurrentPassword', () => {
    const userId = 1;
    const password = 'currentPassword123';

    beforeEach(() => {
      userService.findById.mockResolvedValue(mockUser as any);
    });

    it('should return true for correct password', async () => {
      const hashedPassword = await argon2.hash(password);
      userService.findById.mockResolvedValue({
        ...mockUser,
        password: hashedPassword,
      } as any);

      const result = await service.verifyCurrentPassword(userId, password);
      expect(result).toBe(true);
    });

    it('should throw NotFoundException when user not found', async () => {
      userService.findById.mockResolvedValue(null);

      await expect(service.verifyCurrentPassword(userId, password)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.verifyCurrentPassword(userId, password)).rejects.toThrow(
        'User not found',
      );
    });

    it('should throw BadRequestException for incorrect password', async () => {
      const hashedPassword = await argon2.hash('differentPassword');
      userService.findById.mockResolvedValue({
        ...mockUser,
        password: hashedPassword,
      } as any);

      await expect(service.verifyCurrentPassword(userId, password)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.verifyCurrentPassword(userId, password)).rejects.toThrow(
        'incorrect password',
      );
    });

    it('should handle empty password', async () => {
      const hashedPassword = await argon2.hash(password);
      userService.findById.mockResolvedValue({
        ...mockUser,
        password: hashedPassword,
      } as any);

      await expect(service.verifyCurrentPassword(userId, '')).rejects.toThrow(BadRequestException);
    });

    it('should verify password for different user IDs', async () => {
      const hashedPassword = await argon2.hash(password);
      userService.findById.mockResolvedValue({
        ...mockUser,
        password: hashedPassword,
      } as any);

      await expect(service.verifyCurrentPassword(1, password)).resolves.toBe(true);
      await expect(service.verifyCurrentPassword(2, password)).resolves.toBe(true);

      expect(userService.findById).toHaveBeenCalledWith(1);
      expect(userService.findById).toHaveBeenCalledWith(2);
    });
  });
});
