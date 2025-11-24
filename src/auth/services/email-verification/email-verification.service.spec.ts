import { Test, TestingModule } from '@nestjs/testing';
import { EmailVerificationService } from './email-verification.service';
import { Services } from 'src/utils/constants';

describe('EmailVerificationService', () => {
  let service: EmailVerificationService;

  const mockEmailService = {
    sendEmail: jest.fn(),
  };

  const mockUserService = {
    findByEmail: jest.fn(),
    update: jest.fn(),
  };

  const mockOtpService = {
    generateAndRateLimit: jest.fn(),
    verify: jest.fn(),
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
});
