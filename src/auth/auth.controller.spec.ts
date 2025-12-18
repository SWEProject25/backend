import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Services } from 'src/utils/constants';
import { GoogleRecaptchaGuard } from '@nestlab/google-recaptcha';
import { Response } from 'express';

describe('AuthController', () => {
  let controller: AuthController;
  let mockAuthService: any;
  let mockEmailVerificationService: any;
  let mockJwtTokenService: any;
  let mockPasswordService: any;
  let mockUserService: any;
  let mockResponse: Partial<Response>;

  beforeEach(async () => {
    mockAuthService = {
      registerUser: jest.fn(),
      login: jest.fn(),
      checkEmailExistence: jest.fn(),
      createOAuthCode: jest.fn(),
      verifyGoogleIdToken: jest.fn(),
    };

    mockEmailVerificationService = {
      sendVerificationEmail: jest.fn(),
      resendVerificationEmail: jest.fn(),
      verifyEmail: jest.fn(),
    };

    mockJwtTokenService = {
      generateAccessToken: jest.fn(),
      setAuthCookies: jest.fn(),
    };

    mockPasswordService = {
      requestPasswordReset: jest.fn(),
      verifyResetToken: jest.fn(),
      resetPassword: jest.fn(),
    };

    mockUserService = {
      findOne: jest.fn(),
    };

    mockResponse = {
      clearCookie: jest.fn(),
      redirect: jest.fn(),
      setHeader: jest.fn(),
      send: jest.fn(),
      json: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: Services.AUTH,
          useValue: mockAuthService,
        },
        {
          provide: Services.EMAIL_VERIFICATION,
          useValue: mockEmailVerificationService,
        },
        {
          provide: Services.JWT_TOKEN,
          useValue: mockJwtTokenService,
        },
        {
          provide: Services.PASSWORD,
          useValue: mockPasswordService,
        },
        {
          provide: Services.USER,
          useValue: mockUserService,
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

  describe('register', () => {
    it('should register a user and set cookies', async () => {
      const createUserDto = {
        name: 'John Doe',
        email: 'test@example.com',
        password: 'Password123!',
      };
      const registeredUser = {
        id: 1,
        username: 'john_doe',
        role: 'USER',
        email: 'test@example.com',
        has_completed_following: false,
        has_completed_interests: false,
        Profile: { name: 'John Doe', profile_image_url: null, birth_date: null },
      };
      mockAuthService.registerUser.mockResolvedValue(registeredUser);
      mockJwtTokenService.generateAccessToken.mockResolvedValue('access_token');

      const result = await controller.register(createUserDto as any, mockResponse as Response);

      expect(mockAuthService.registerUser).toHaveBeenCalledWith(createUserDto);
      expect(mockJwtTokenService.setAuthCookies).toHaveBeenCalled();
      expect(result.status).toBe('success');
      expect(result.data.user.id).toBe(1);
    });
  });

  describe('login', () => {
    it('should login user and set cookies', async () => {
      const mockRequest = {
        user: { sub: 1, username: 'john_doe' },
      };
      mockAuthService.login.mockResolvedValue({
        accessToken: 'access_token',
        user: { id: 1, username: 'john_doe' },
        onboarding: { hasCompeletedFollowing: false },
      });

      const result = await controller.login(mockRequest as any, mockResponse as Response);

      expect(mockJwtTokenService.setAuthCookies).toHaveBeenCalled();
      expect(result.status).toBe('success');
    });
  });

  describe('getMe', () => {
    it('should return current user data', async () => {
      const mockUser = { id: 1 };
      mockUserService.findOne.mockResolvedValue({
        username: 'john_doe',
        role: 'USER',
        email: 'test@example.com',
        has_completed_following: false,
        has_completed_interests: false,
        Profile: { name: 'John Doe', profile_image_url: null, birth_date: null },
      });

      const result = await controller.getMe(mockUser as any);

      expect(result.status).toBe('success');
      expect(result.data.user.id).toBe(1);
    });
  });

  describe('logout', () => {
    it('should clear cookies', () => {
      const result = controller.logout(mockResponse as Response);

      expect(mockResponse.clearCookie).toHaveBeenCalledWith('access_token');
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('refresh_token');
      expect(result.message).toBe('Logout successful');
    });
  });

  describe('checkEmail', () => {
    it('should check email availability', async () => {
      mockAuthService.checkEmailExistence.mockResolvedValue(undefined);

      const result = await controller.checkEmail({ email: 'test@example.com' });

      expect(mockAuthService.checkEmailExistence).toHaveBeenCalledWith('test@example.com');
      expect(result.message).toBe('Email is available');
    });
  });

  describe('generateVerificationEmail', () => {
    it('should send verification email', async () => {
      mockEmailVerificationService.sendVerificationEmail.mockResolvedValue(undefined);

      const result = await controller.generateVerificationEmail({ email: 'test@example.com' });

      expect(mockEmailVerificationService.sendVerificationEmail).toHaveBeenCalledWith('test@example.com');
      expect(result.status).toBe('success');
    });
  });

  describe('resendVerificationEmail', () => {
    it('should resend verification email', async () => {
      mockEmailVerificationService.resendVerificationEmail.mockResolvedValue(undefined);

      const result = await controller.resendVerificationEmail({ email: 'test@example.com' });

      expect(mockEmailVerificationService.resendVerificationEmail).toHaveBeenCalledWith('test@example.com');
      expect(result.status).toBe('success');
    });
  });

  describe('verifyEmailOtp', () => {
    it('should verify OTP successfully', async () => {
      mockEmailVerificationService.verifyEmail.mockResolvedValue(true);

      const result = await controller.verifyEmailOtp({ email: 'test@example.com', otp: '123456' });

      expect(result.status).toBe('success');
      expect(result.message).toBe('email verified');
    });

    it('should return fail status when OTP is invalid', async () => {
      mockEmailVerificationService.verifyEmail.mockResolvedValue(false);

      const result = await controller.verifyEmailOtp({ email: 'test@example.com', otp: 'wrong' });

      expect(result.status).toBe('fail');
    });
  });

  describe('verifyRecaptcha', () => {
    it('should return success for valid recaptcha', () => {
      const result = controller.verifyRecaptcha({ recaptchaToken: 'valid_token' } as any);

      expect(result.status).toBe('success');
      expect(result.message).toBe('Human verification successful.');
    });
  });

  describe('requestPasswordReset', () => {
    it('should request password reset', async () => {
      mockPasswordService.requestPasswordReset.mockResolvedValue(undefined);

      const result = await controller.requestPasswordReset({ email: 'test@example.com' });

      expect(mockPasswordService.requestPasswordReset).toHaveBeenCalled();
      expect(result.status).toBe('success');
    });
  });

  describe('verifyResetToken', () => {
    it('should verify reset token', async () => {
      mockPasswordService.verifyResetToken.mockResolvedValue(true);

      const result = await controller.verifyResetToken({ userId: 1, token: 'valid_token' });

      expect(result.status).toBe('success');
      expect(result.data.valid).toBe(true);
    });
  });

  describe('resetPassword', () => {
    it('should reset password', async () => {
      mockPasswordService.verifyResetToken.mockResolvedValue(true);
      mockPasswordService.resetPassword.mockResolvedValue(undefined);

      const result = await controller.resetPassword({
        userId: 1,
        token: 'valid_token',
        newPassword: 'NewPassword123!',
        email: 'test@example.com',
      } as any);

      expect(mockPasswordService.verifyResetToken).toHaveBeenCalled();
      expect(mockPasswordService.resetPassword).toHaveBeenCalled();
      expect(result.status).toBe('success');
    });
  });

  describe('googleLogin', () => {
    it('should return success message', () => {
      const result = controller.googleLogin();

      expect(result.status).toBe('success');
    });
  });

  describe('githubLogin', () => {
    it('should return undefined (handled by guard)', () => {
      const result = controller.githubLogin();

      expect(result).toBeUndefined();
    });
  });

  describe('googleMobileLogin', () => {
    it('should login via Google mobile token', async () => {
      mockAuthService.verifyGoogleIdToken.mockResolvedValue({
        accessToken: 'access_token',
        result: {
          user: { id: 1, username: 'john' },
          onboarding: { hasCompeletedFollowing: false },
        },
      });

      await controller.googleMobileLogin({ idToken: 'google_id_token' }, mockResponse as Response);

      expect(mockJwtTokenService.setAuthCookies).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalled();
    });
  });
});

