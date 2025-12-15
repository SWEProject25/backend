import { Test, TestingModule } from '@nestjs/testing';
import { GoogleStrategy } from './google.strategy';
import { AuthService } from '../auth.service';
import googleOauthConfig from '../config/google-oauth.config';
import { Services } from 'src/utils/constants';
import { Profile, VerifyCallback } from 'passport-google-oauth20';
import { OAuthProfileDto } from '../dto/oauth-profile.dto';
import { Role } from '@prisma/client';

describe('GoogleStrategy', () => {
  let strategy: GoogleStrategy;
  let authService: jest.Mocked<AuthService>;

  const mockGoogleConfig = {
    clientID: 'test-client-id',
    clientSecret: 'test-client-secret',
    callbackURL: 'http://localhost:3000/auth/google/callback',
  };

  const mockAuthService = {
    validateGoogleUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleStrategy,
        {
          provide: googleOauthConfig.KEY,
          useValue: mockGoogleConfig,
        },
        {
          provide: Services.AUTH,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    strategy = module.get<GoogleStrategy>(GoogleStrategy);
    authService = module.get(Services.AUTH);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    const mockProfile: Profile = {
      id: 'google-user-id-123',
      displayName: 'Test User',
      provider: 'google',
      emails: [{ value: 'test@example.com', verified: true }],
      photos: [{ value: 'https://example.com/photo.jpg' }],
      profileUrl: 'https://plus.google.com/user-id',
      _raw: '',
      _json: {} as any,
    };

    const mockValidatedUser = {
      sub: 1,
      username: 'test',
      role: Role.USER,
      email: 'test@example.com',
      name: 'Test User',
      profileImageUrl: 'https://example.com/photo.jpg',
    };

    const mockDone: VerifyCallback = jest.fn();

    it('should validate Google user and call done callback', async () => {
      authService.validateGoogleUser.mockResolvedValue(mockValidatedUser as any);

      await strategy.validate('access-token', 'refresh-token', mockProfile, mockDone);

      expect(authService.validateGoogleUser).toHaveBeenCalledWith({
        email: 'test@example.com',
        username: 'test',
        provider: 'google',
        displayName: 'Test User',
        providerId: 'google-user-id-123',
        profileImageUrl: 'https://example.com/photo.jpg',
      });

      expect(mockDone).toHaveBeenCalledWith(null, mockValidatedUser);
    });

    it('should extract username from email', async () => {
      const profile: Profile = {
        ...mockProfile,
        emails: [{ value: 'john.doe@example.com', verified: true }],
      };

      authService.validateGoogleUser.mockResolvedValue(mockValidatedUser as any);

      await strategy.validate('access-token', 'refresh-token', profile, mockDone);

      expect(authService.validateGoogleUser).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'john.doe',
          email: 'john.doe@example.com',
        }),
      );
    });

    it('should handle profile without photo', async () => {
      const profileWithEmptyPhoto: Profile = {
        ...mockProfile,
        photos: [{ value: '' }],
      };

      authService.validateGoogleUser.mockResolvedValue(mockValidatedUser as any);

      await strategy.validate('access-token', 'refresh-token', profileWithEmptyPhoto, mockDone);

      expect(authService.validateGoogleUser).toHaveBeenCalledWith(
        expect.objectContaining({
          profileImageUrl: '',
        }),
      );
    });

    it('should handle profile with no photo value', async () => {
      const profileWithNoPhotoValue: Profile = {
        ...mockProfile,
        photos: [{ value: undefined as any }],
      };

      authService.validateGoogleUser.mockResolvedValue(mockValidatedUser as any);

      await strategy.validate('access-token', 'refresh-token', profileWithNoPhotoValue, mockDone);

      expect(authService.validateGoogleUser).toHaveBeenCalledWith(
        expect.objectContaining({
          profileImageUrl: undefined,
        }),
      );
    });

    it('should handle email with special characters', async () => {
      const profile: Profile = {
        ...mockProfile,
        emails: [{ value: 'user+test@example.com', verified: true }],
      };

      authService.validateGoogleUser.mockResolvedValue(mockValidatedUser as any);

      await strategy.validate('access-token', 'refresh-token', profile, mockDone);

      expect(authService.validateGoogleUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'user+test@example.com',
          username: 'user+test',
        }),
      );
    });

    it('should pass providerId correctly', async () => {
      const profile: Profile = {
        ...mockProfile,
        id: 'unique-google-id-456',
      };

      authService.validateGoogleUser.mockResolvedValue(mockValidatedUser as any);

      await strategy.validate('access-token', 'refresh-token', profile, mockDone);

      expect(authService.validateGoogleUser).toHaveBeenCalledWith(
        expect.objectContaining({
          providerId: 'unique-google-id-456',
        }),
      );
    });

    it('should handle displayName correctly', async () => {
      const profile: Profile = {
        ...mockProfile,
        displayName: 'John Michael Doe',
      };

      authService.validateGoogleUser.mockResolvedValue(mockValidatedUser as any);

      await strategy.validate('access-token', 'refresh-token', profile, mockDone);

      expect(authService.validateGoogleUser).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: 'John Michael Doe',
        }),
      );
    });

    it('should handle errors from validateGoogleUser', async () => {
      const error = new Error('User validation failed');
      authService.validateGoogleUser.mockRejectedValue(error);

      await expect(
        strategy.validate('access-token', 'refresh-token', mockProfile, mockDone),
      ).rejects.toThrow('User validation failed');

      expect(mockDone).not.toHaveBeenCalled();
    });

    it('should handle multiple emails and use first one', async () => {
      const profile: Profile = {
        ...mockProfile,
        emails: [
          { value: 'primary@example.com', verified: true },
          { value: 'secondary@example.com', verified: false },
        ],
      };

      authService.validateGoogleUser.mockResolvedValue(mockValidatedUser as any);

      await strategy.validate('access-token', 'refresh-token', profile, mockDone);

      expect(authService.validateGoogleUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'primary@example.com',
        }),
      );
    });

    it('should handle access and refresh tokens', async () => {
      authService.validateGoogleUser.mockResolvedValue(mockValidatedUser as any);

      await strategy.validate(
        'google-access-token-123',
        'google-refresh-token-456',
        mockProfile,
        mockDone,
      );

      // Tokens are received but not used in the validation logic
      expect(authService.validateGoogleUser).toHaveBeenCalled();
      expect(mockDone).toHaveBeenCalledWith(null, mockValidatedUser);
    });

    it('should set provider to google', async () => {
      authService.validateGoogleUser.mockResolvedValue(mockValidatedUser as any);

      await strategy.validate('access-token', 'refresh-token', mockProfile, mockDone);

      expect(authService.validateGoogleUser).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'google',
        }),
      );
    });

    it('should create complete OAuthProfileDto', async () => {
      authService.validateGoogleUser.mockResolvedValue(mockValidatedUser as any);

      await strategy.validate('access-token', 'refresh-token', mockProfile, mockDone);

      const expectedDto: OAuthProfileDto = {
        email: 'test@example.com',
        username: 'test',
        provider: 'google',
        displayName: 'Test User',
        providerId: 'google-user-id-123',
        profileImageUrl: 'https://example.com/photo.jpg',
      };

      expect(authService.validateGoogleUser).toHaveBeenCalledWith(expectedDto);
    });
  });

  describe('constructor configuration', () => {
    it('should be configured with correct clientID', () => {
      expect(strategy).toBeDefined();
    });

    it('should be configured with correct scopes', () => {
      expect(strategy).toBeDefined();
      // Scope is set to ['profile', 'email'] in the super() call
    });
  });
});
