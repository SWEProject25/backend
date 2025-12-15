import { Test, TestingModule } from '@nestjs/testing';
import { EmailVerificationService } from './email-verification.service';
import { Services } from 'src/utils/constants';
import { EmailService } from 'src/email/email.service';
import { UserService } from 'src/user/user.service';
import { OtpService } from '../otp/otp.service';
import { RedisService } from 'src/redis/redis.service';
import {
  ConflictException,
  HttpException,
  HttpStatus,
  UnprocessableEntityException,
} from '@nestjs/common';

describe('EmailVerificationService', () => {
  let service: EmailVerificationService;
  let emailService: jest.Mocked<EmailService>;
  let userService: jest.Mocked<UserService>;
  let otpService: jest.Mocked<OtpService>;
  let redisService: jest.Mocked<RedisService>;

  const mockUser = {
    id: 1,
    email: 'test@example.com',
    username: 'testuser',
    is_verified: false,
  };

  const mockEmailService = {
    queueTemplateEmail: jest.fn(),
  };

  const mockUserService = {
    findByEmail: jest.fn(),
    update: jest.fn(),
  };

  const mockOtpService = {
    generateAndRateLimit: jest.fn(),
    validate: jest.fn(),
    isRateLimited: jest.fn(),
  };

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailVerificationService,
        {
          provide: Services.EMAIL,
          useValue: mockEmailService,
        },
        {
          provide: Services.USER,
          useValue: mockUserService,
        },
        {
          provide: Services.OTP,
          useValue: mockOtpService,
        },
        {
          provide: Services.REDIS,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<EmailVerificationService>(EmailVerificationService);
    emailService = module.get(Services.EMAIL);
    userService = module.get(Services.USER);
    otpService = module.get(Services.OTP);
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
      expect(emailService).toBeDefined();
      expect(userService).toBeDefined();
      expect(otpService).toBeDefined();
      expect(redisService).toBeDefined();
    });
  });

  describe('sendVerificationEmail', () => {
    const email = 'test@example.com';

    beforeEach(() => {
      otpService.isRateLimited.mockResolvedValue(false);
      userService.findByEmail.mockResolvedValue(mockUser as any);
      otpService.generateAndRateLimit.mockResolvedValue('123456');
      emailService.queueTemplateEmail.mockResolvedValue(undefined as any);
    });

    it('should send verification email successfully', async () => {
      await service.sendVerificationEmail(email);

      expect(otpService.isRateLimited).toHaveBeenCalledWith(email);
      expect(userService.findByEmail).toHaveBeenCalledWith(email);
      expect(otpService.generateAndRateLimit).toHaveBeenCalledWith(email);
      expect(emailService.queueTemplateEmail).toHaveBeenCalledWith(
        [email],
        'Account Verification',
        'email-verification.html',
        { verificationCode: '123456' },
      );
    });

    it('should throw HttpException when rate limited', async () => {
      otpService.isRateLimited.mockResolvedValue(true);

      await expect(service.sendVerificationEmail(email)).rejects.toThrow(HttpException);
      await expect(service.sendVerificationEmail(email)).rejects.toThrow(
        'Please wait 60 seconds before requesting another email.',
      );

      expect(userService.findByEmail).not.toHaveBeenCalled();
      expect(otpService.generateAndRateLimit).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if user already verified', async () => {
      userService.findByEmail.mockResolvedValue({
        ...mockUser,
        is_verified: true,
      } as any);

      await expect(service.sendVerificationEmail(email)).rejects.toThrow(ConflictException);
      await expect(service.sendVerificationEmail(email)).rejects.toThrow(
        'Account already verified',
      );

      expect(otpService.generateAndRateLimit).not.toHaveBeenCalled();
    });

    it('should handle null user (new registration)', async () => {
      userService.findByEmail.mockResolvedValue(null);

      await service.sendVerificationEmail(email);

      expect(otpService.generateAndRateLimit).toHaveBeenCalledWith(email);
      expect(emailService.queueTemplateEmail).toHaveBeenCalled();
    });

    it('should generate OTP and send email for unverified user', async () => {
      await service.sendVerificationEmail(email);

      expect(otpService.generateAndRateLimit).toHaveBeenCalledWith(email);

      const emailCall = emailService.queueTemplateEmail.mock.calls[0];
      expect(emailCall[0]).toEqual([email]);
      expect(emailCall[1]).toBe('Account Verification');
      expect(emailCall[2]).toBe('email-verification.html');
      expect(emailCall[3]).toEqual({ verificationCode: '123456' });
    });

    it('should handle different OTP values', async () => {
      const otpValues = ['111111', '222222', '999999'];

      for (const otp of otpValues) {
        otpService.generateAndRateLimit.mockResolvedValue(otp);

        await service.sendVerificationEmail(email);

        const emailCall =
          emailService.queueTemplateEmail.mock.calls[
            emailService.queueTemplateEmail.mock.calls.length - 1
          ];
        expect(emailCall[3]).toEqual({ verificationCode: otp });
      }
    });

    it('should handle special characters in email', async () => {
      const specialEmail = 'user+tag@example.com';

      await service.sendVerificationEmail(specialEmail);

      expect(otpService.isRateLimited).toHaveBeenCalledWith(specialEmail);
      expect(userService.findByEmail).toHaveBeenCalledWith(specialEmail);
    });

    it('should check rate limiting before generating OTP', async () => {
      otpService.isRateLimited.mockResolvedValue(true);

      await expect(service.sendVerificationEmail(email)).rejects.toThrow();

      expect(otpService.generateAndRateLimit).not.toHaveBeenCalled();
    });

    it('should use correct HTTP status code for rate limiting', async () => {
      otpService.isRateLimited.mockResolvedValue(true);

      try {
        await service.sendVerificationEmail(email);
        fail('Should have thrown an exception');
      } catch (error: any) {
        expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        expect(error.getStatus()).toBe(429);
      }
    });
  });

  describe('resendVerificationEmail', () => {
    const email = 'test@example.com';

    beforeEach(() => {
      otpService.isRateLimited.mockResolvedValue(false);
      userService.findByEmail.mockResolvedValue(mockUser as any);
      otpService.generateAndRateLimit.mockResolvedValue('123456');
      emailService.queueTemplateEmail.mockResolvedValue(undefined as any);
    });

    it('should resend verification email successfully', async () => {
      await service.resendVerificationEmail(email);

      expect(otpService.isRateLimited).toHaveBeenCalledWith(email);
      expect(userService.findByEmail).toHaveBeenCalledWith(email);
      expect(otpService.generateAndRateLimit).toHaveBeenCalledWith(email);
      expect(emailService.queueTemplateEmail).toHaveBeenCalled();
    });

    it('should throw same exceptions as sendVerificationEmail', async () => {
      otpService.isRateLimited.mockResolvedValue(true);

      await expect(service.resendVerificationEmail(email)).rejects.toThrow(HttpException);
    });

    it('should call sendVerificationEmail internally', async () => {
      const sendSpy = jest.spyOn(service, 'sendVerificationEmail');

      await service.resendVerificationEmail(email);

      expect(sendSpy).toHaveBeenCalledWith(email);
    });

    it('should handle already verified users', async () => {
      userService.findByEmail.mockResolvedValue({
        ...mockUser,
        is_verified: true,
      } as any);

      await expect(service.resendVerificationEmail(email)).rejects.toThrow(ConflictException);
    });

    it('should respect rate limiting', async () => {
      otpService.isRateLimited.mockResolvedValue(true);

      await expect(service.resendVerificationEmail(email)).rejects.toThrow();
      expect(otpService.generateAndRateLimit).not.toHaveBeenCalled();
    });
  });

  describe('verifyEmail', () => {
    const verifyDto = {
      email: 'test@example.com',
      otp: '111111', // Different from TESTING_VALID_OTP
    };

    beforeEach(() => {
      userService.findByEmail.mockResolvedValue(mockUser as any);
      otpService.validate.mockResolvedValue(true);
      redisService.set.mockResolvedValue(undefined);
    });

    it('should verify email successfully', async () => {
      const result = await service.verifyEmail(verifyDto);

      expect(result).toBe(true);
      expect(userService.findByEmail).toHaveBeenCalledWith(verifyDto.email);
      expect(otpService.validate).toHaveBeenCalledWith(verifyDto.email, verifyDto.otp);
      expect(redisService.set).toHaveBeenCalledWith(
        `verified:${verifyDto.email}`,
        'true',
        600, // 10 minutes
      );
    });

    it('should throw ConflictException if already verified', async () => {
      userService.findByEmail.mockResolvedValue({
        ...mockUser,
        is_verified: true,
      } as any);

      await expect(service.verifyEmail(verifyDto)).rejects.toThrow(ConflictException);
      await expect(service.verifyEmail(verifyDto)).rejects.toThrow('Account already verified');

      expect(otpService.validate).not.toHaveBeenCalled();
    });

    it('should throw UnprocessableEntityException for invalid OTP', async () => {
      otpService.validate.mockResolvedValue(false);

      await expect(service.verifyEmail(verifyDto)).rejects.toThrow(UnprocessableEntityException);
      await expect(service.verifyEmail(verifyDto)).rejects.toThrow('Invalid or expired OTP');
    });

    it('should accept testing OTP bypass', async () => {
      const testDto = {
        email: 'test@example.com',
        otp: '123456', // TESTING_VALID_OTP
      };
      otpService.validate.mockResolvedValue(false);

      const result = await service.verifyEmail(testDto);

      expect(result).toBe(true);
      expect(redisService.set).toHaveBeenCalled();
    });

    it('should reject non-testing invalid OTP', async () => {
      const invalidDto = {
        email: 'test@example.com',
        otp: '999999',
      };
      otpService.validate.mockResolvedValue(false);

      await expect(service.verifyEmail(invalidDto)).rejects.toThrow();
    });

    it('should store verification status in Redis', async () => {
      await service.verifyEmail(verifyDto);

      expect(redisService.set).toHaveBeenCalledWith(`verified:${verifyDto.email}`, 'true', 600);
    });

    it('should handle null user', async () => {
      userService.findByEmail.mockResolvedValue(null);

      const result = await service.verifyEmail(verifyDto);

      expect(result).toBe(true);
      expect(otpService.validate).toHaveBeenCalled();
    });

    it('should validate OTP before setting cache', async () => {
      otpService.validate.mockResolvedValue(false);

      await expect(service.verifyEmail(verifyDto)).rejects.toThrow();
      expect(redisService.set).not.toHaveBeenCalled();
    });

    it('should handle special characters in email', async () => {
      const specialDto = {
        email: 'user+tag@example.com',
        otp: '123456',
      };

      await service.verifyEmail(specialDto);

      expect(userService.findByEmail).toHaveBeenCalledWith(specialDto.email);
      expect(otpService.validate).toHaveBeenCalledWith(specialDto.email, specialDto.otp);
      expect(redisService.set).toHaveBeenCalledWith(`verified:${specialDto.email}`, 'true', 600);
    });

    it('should validate exact OTP match', async () => {
      const correctDto = {
        email: 'test@example.com',
        otp: '123456',
      };
      const wrongDto = {
        email: 'test@example.com',
        otp: '654321',
      };

      otpService.validate.mockImplementation((email, otp) => {
        return Promise.resolve(otp === '123456');
      });

      await expect(service.verifyEmail(correctDto)).resolves.toBe(true);

      otpService.validate.mockResolvedValue(false);
      await expect(service.verifyEmail(wrongDto)).rejects.toThrow();
    });

    it('should set correct TTL for verification cache', async () => {
      await service.verifyEmail(verifyDto);

      const setCall = redisService.set.mock.calls[0];
      expect(setCall[2]).toBe(600); // 10 minutes in seconds
    });
  });
});
