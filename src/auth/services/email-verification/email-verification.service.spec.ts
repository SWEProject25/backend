import { Test, TestingModule } from '@nestjs/testing';
import { EmailVerificationService } from './email-verification.service';
import { Services } from 'src/utils/constants';
import { HttpException, HttpStatus, ConflictException, UnprocessableEntityException } from '@nestjs/common';

describe('EmailVerificationService', () => {
  let service: EmailVerificationService;

  const mockEmailService = {
    sendEmail: jest.fn(),
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
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: Services.EMAIL_VERIFICATION,
          useClass: EmailVerificationService,
        },
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

    service = module.get<EmailVerificationService>(Services.EMAIL_VERIFICATION);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendVerificationEmail', () => {
    const testEmail = 'test@example.com';

    it('should throw HttpException when rate limited', async () => {
      mockOtpService.isRateLimited.mockResolvedValue(true);

      await expect(service.sendVerificationEmail(testEmail)).rejects.toThrow(
        new HttpException(
          'Please wait 60 seconds before requesting another email.',
          HttpStatus.TOO_MANY_REQUESTS,
        ),
      );

      expect(mockOtpService.isRateLimited).toHaveBeenCalledWith(testEmail);
    });

    it('should throw ConflictException when user is already verified', async () => {
      mockOtpService.isRateLimited.mockResolvedValue(false);
      mockUserService.findByEmail.mockResolvedValue({ is_verified: true });

      await expect(service.sendVerificationEmail(testEmail)).rejects.toThrow(
        new ConflictException('Account already verified'),
      );
    });

    it('should send verification email successfully when user is not verified', async () => {
      const mockOtp = '654321';
      mockOtpService.isRateLimited.mockResolvedValue(false);
      mockUserService.findByEmail.mockResolvedValue({ is_verified: false });
      mockOtpService.generateAndRateLimit.mockResolvedValue(mockOtp);
      mockEmailService.queueTemplateEmail.mockResolvedValue(undefined);

      await service.sendVerificationEmail(testEmail);

      expect(mockOtpService.generateAndRateLimit).toHaveBeenCalledWith(testEmail);
      expect(mockEmailService.queueTemplateEmail).toHaveBeenCalledWith(
        [testEmail],
        'Account Verification',
        'email-verification.html',
        { verificationCode: mockOtp },
      );
    });

    it('should send verification email when user does not exist', async () => {
      const mockOtp = '654321';
      mockOtpService.isRateLimited.mockResolvedValue(false);
      mockUserService.findByEmail.mockResolvedValue(null);
      mockOtpService.generateAndRateLimit.mockResolvedValue(mockOtp);
      mockEmailService.queueTemplateEmail.mockResolvedValue(undefined);

      await service.sendVerificationEmail(testEmail);

      expect(mockOtpService.generateAndRateLimit).toHaveBeenCalledWith(testEmail);
      expect(mockEmailService.queueTemplateEmail).toHaveBeenCalled();
    });
  });

  describe('resendVerificationEmail', () => {
    it('should delegate to sendVerificationEmail', async () => {
      const testEmail = 'test@example.com';
      const mockOtp = '654321';
      mockOtpService.isRateLimited.mockResolvedValue(false);
      mockUserService.findByEmail.mockResolvedValue(null);
      mockOtpService.generateAndRateLimit.mockResolvedValue(mockOtp);
      mockEmailService.queueTemplateEmail.mockResolvedValue(undefined);

      await service.resendVerificationEmail(testEmail);

      expect(mockOtpService.isRateLimited).toHaveBeenCalledWith(testEmail);
      expect(mockEmailService.queueTemplateEmail).toHaveBeenCalled();
    });
  });

  describe('verifyEmail', () => {
    const verifyOtpDto = { email: 'test@example.com', otp: '654321' };

    it('should throw ConflictException when user is already verified', async () => {
      mockUserService.findByEmail.mockResolvedValue({ is_verified: true });

      await expect(service.verifyEmail(verifyOtpDto)).rejects.toThrow(
        new ConflictException('Account already verified'),
      );
    });

    it('should throw UnprocessableEntityException when OTP is invalid', async () => {
      mockUserService.findByEmail.mockResolvedValue({ is_verified: false });
      mockOtpService.validate.mockResolvedValue(false);

      await expect(service.verifyEmail(verifyOtpDto)).rejects.toThrow(
        new UnprocessableEntityException('Invalid or expired OTP'),
      );
    });

    it('should verify email successfully with valid OTP', async () => {
      mockUserService.findByEmail.mockResolvedValue({ is_verified: false });
      mockOtpService.validate.mockResolvedValue(true);
      mockRedisService.set.mockResolvedValue(undefined);

      const result = await service.verifyEmail(verifyOtpDto);

      expect(result).toBe(true);
      expect(mockRedisService.set).toHaveBeenCalledWith(
        `verified:${verifyOtpDto.email}`,
        'true',
        600, // 10 minutes
      );
    });

    it('should verify email successfully with testing OTP (123456)', async () => {
      const testingOtpDto = { email: 'test@example.com', otp: '123456' };
      mockUserService.findByEmail.mockResolvedValue({ is_verified: false });
      mockOtpService.validate.mockResolvedValue(false); // Invalid but bypassed

      const result = await service.verifyEmail(testingOtpDto);

      expect(result).toBe(true);
      expect(mockRedisService.set).toHaveBeenCalled();
    });

    it('should verify email when user does not exist', async () => {
      mockUserService.findByEmail.mockResolvedValue(null);
      mockOtpService.validate.mockResolvedValue(true);
      mockRedisService.set.mockResolvedValue(undefined);

      const result = await service.verifyEmail(verifyOtpDto);

      expect(result).toBe(true);
    });
  });
});
