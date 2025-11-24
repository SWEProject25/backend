import { Test, TestingModule } from '@nestjs/testing';
import { OtpService } from './otp.service';
import { Services } from 'src/utils/constants';

describe('OtpService', () => {
  let service: OtpService;

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: Services.OTP,
          useClass: OtpService,
        },
        {
          provide: Services.REDIS,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<OtpService>(Services.OTP);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
