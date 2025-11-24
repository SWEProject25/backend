import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Services } from 'src/utils/constants';
import { APP_GUARD } from '@nestjs/core';
import { GoogleRecaptchaGuard } from '@nestlab/google-recaptcha';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    verifyEmail: jest.fn(),
    resendVerificationEmail: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    refreshTokens: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: Services.AUTH,
          useValue: mockAuthService,
        },
        {
          provide: Services.EMAIL,
          useValue: {},
        },
        {
          provide: Services.PASSWORD,
          useValue: {},
        },
        {
          provide: Services.EMAIL_VERIFICATION,
          useValue: {},
        },
        {
          provide: Services.JWT_TOKEN,
          useValue: {},
        },
        {
          provide: Services.OTP,
          useValue: {},
        },
        {
          provide: Services.USER,
          useValue: {},
        },
      ],
    })
      .overrideGuard(GoogleRecaptchaGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
