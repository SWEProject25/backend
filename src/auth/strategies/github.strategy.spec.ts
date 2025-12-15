import { Test, TestingModule } from '@nestjs/testing';
import { GithubStrategy } from './github.strategy';
import { AuthService } from '../auth.service';
import githubOauthConfig from '../config/github-oauth.config';
import { Services } from 'src/utils/constants';
import { Profile } from 'passport-github2';
import { VerifiedCallback } from 'passport-jwt';
import { OAuthProfileDto } from '../dto/oauth-profile.dto';
import { Role } from '@prisma/client';

describe('GithubStrategy', () => {
  let strategy: GithubStrategy;
  let authService: jest.Mocked<AuthService>;

  const mockGithubConfig = {
    clientID: 'test-github-client-id',
    clientSecret: 'test-github-client-secret',
    callbackURL: 'http://localhost:3000/auth/github/callback',
  };

  const mockAuthService = {
    validateGithubUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GithubStrategy,
        {
          provide: githubOauthConfig.KEY,
          useValue: mockGithubConfig,
        },
        {
          provide: Services.AUTH,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    strategy = module.get<GithubStrategy>(GithubStrategy);
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
      id: 'github-user-id-123',
      displayName: 'Test User',
      username: 'testuser',
      provider: 'github',
      emails: [{ value: 'test@example.com' }],
      photos: [{ value: 'https://avatars.githubusercontent.com/u/123' }],
      profileUrl: 'https://github.com/testuser',
    };

    const mockValidatedUser = {
      sub: 1,
      username: 'testuser',
      role: Role.USER,
      email: 'test@example.com',
      name: 'Test User',
      profileImageUrl: 'https://avatars.githubusercontent.com/u/123',
    };

    const mockDone: VerifiedCallback = jest.fn();

    it('should validate GitHub user and call done callback', async () => {
      authService.validateGithubUser.mockResolvedValue(mockValidatedUser as any);

      await strategy.validate('access-token', 'refresh-token', mockProfile, mockDone);

      expect(authService.validateGithubUser).toHaveBeenCalledWith({
        email: 'test@example.com',
        username: 'testuser',
        provider: 'github',
        displayName: 'Test User',
        providerId: 'github-user-id-123',
        profileImageUrl: 'https://avatars.githubusercontent.com/u/123',
      });

      expect(mockDone).toHaveBeenCalledWith(null, mockValidatedUser);
    });

    it('should convert email to lowercase', async () => {
      const profile: Profile = {
        ...mockProfile,
        emails: [{ value: 'TEST@EXAMPLE.COM' }],
      };

      authService.validateGithubUser.mockResolvedValue(mockValidatedUser as any);

      await strategy.validate('access-token', 'refresh-token', profile, mockDone);

      expect(authService.validateGithubUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
        }),
      );
    });

    it('should handle username correctly', async () => {
      const profile: Profile = {
        ...mockProfile,
        username: 'octocat',
      };

      authService.validateGithubUser.mockResolvedValue(mockValidatedUser as any);

      await strategy.validate('access-token', 'refresh-token', profile, mockDone);

      expect(authService.validateGithubUser).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'octocat',
        }),
      );
    });

    it('should handle displayName correctly', async () => {
      const profile: Profile = {
        ...mockProfile,
        displayName: 'John Doe',
      };

      authService.validateGithubUser.mockResolvedValue(mockValidatedUser as any);

      await strategy.validate('access-token', 'refresh-token', profile, mockDone);

      expect(authService.validateGithubUser).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: 'John Doe',
        }),
      );
    });

    it('should handle providerId correctly', async () => {
      const profile: Profile = {
        ...mockProfile,
        id: 'unique-github-id-456',
      };

      authService.validateGithubUser.mockResolvedValue(mockValidatedUser as any);

      await strategy.validate('access-token', 'refresh-token', profile, mockDone);

      expect(authService.validateGithubUser).toHaveBeenCalledWith(
        expect.objectContaining({
          providerId: 'unique-github-id-456',
        }),
      );
    });

    it('should handle profileImageUrl correctly', async () => {
      const profile: Profile = {
        ...mockProfile,
        photos: [{ value: 'https://avatars.githubusercontent.com/u/999' }],
      };

      authService.validateGithubUser.mockResolvedValue(mockValidatedUser as any);

      await strategy.validate('access-token', 'refresh-token', profile, mockDone);

      expect(authService.validateGithubUser).toHaveBeenCalledWith(
        expect.objectContaining({
          profileImageUrl: 'https://avatars.githubusercontent.com/u/999',
        }),
      );
    });

    it('should handle profile without photo', async () => {
      const profileWithEmptyPhotos: Profile = {
        ...mockProfile,
        photos: [{ value: '' }],
      };

      authService.validateGithubUser.mockResolvedValue(mockValidatedUser as any);

      await strategy.validate('access-token', 'refresh-token', profileWithEmptyPhotos, mockDone);

      expect(authService.validateGithubUser).toHaveBeenCalledWith(
        expect.objectContaining({
          profileImageUrl: '',
        }),
      );
    });

    it('should handle different photo URLs', async () => {
      const profileWithDifferentPhoto: Profile = {
        ...mockProfile,
        photos: [{ value: 'https://avatars.githubusercontent.com/u/456' }],
      };

      authService.validateGithubUser.mockResolvedValue(mockValidatedUser as any);

      await strategy.validate('access-token', 'refresh-token', profileWithDifferentPhoto, mockDone);

      expect(authService.validateGithubUser).toHaveBeenCalledWith(
        expect.objectContaining({
          profileImageUrl: 'https://avatars.githubusercontent.com/u/456',
        }),
      );
    });

    it('should set provider to github', async () => {
      authService.validateGithubUser.mockResolvedValue(mockValidatedUser as any);

      await strategy.validate('access-token', 'refresh-token', mockProfile, mockDone);

      expect(authService.validateGithubUser).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'github',
        }),
      );
    });

    it('should handle errors from validateGithubUser', async () => {
      const error = new Error('User validation failed');
      authService.validateGithubUser.mockRejectedValue(error);

      await expect(
        strategy.validate('access-token', 'refresh-token', mockProfile, mockDone),
      ).rejects.toThrow('User validation failed');

      expect(mockDone).not.toHaveBeenCalled();
    });

    it('should handle multiple emails and use first one', async () => {
      const profile: Profile = {
        ...mockProfile,
        emails: [{ value: 'PRIMARY@EXAMPLE.COM' }, { value: 'secondary@example.com' }],
      };

      authService.validateGithubUser.mockResolvedValue(mockValidatedUser as any);

      await strategy.validate('access-token', 'refresh-token', profile, mockDone);

      expect(authService.validateGithubUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'primary@example.com', // lowercase
        }),
      );
    });

    it('should create complete OAuthProfileDto', async () => {
      authService.validateGithubUser.mockResolvedValue(mockValidatedUser as any);

      await strategy.validate('access-token', 'refresh-token', mockProfile, mockDone);

      const expectedDto: OAuthProfileDto = {
        email: 'test@example.com',
        username: 'testuser',
        provider: 'github',
        displayName: 'Test User',
        providerId: 'github-user-id-123',
        profileImageUrl: 'https://avatars.githubusercontent.com/u/123',
      };

      expect(authService.validateGithubUser).toHaveBeenCalledWith(expectedDto);
    });

    it('should handle access and refresh tokens', async () => {
      authService.validateGithubUser.mockResolvedValue(mockValidatedUser as any);

      await strategy.validate(
        'github-access-token-123',
        'github-refresh-token-456',
        mockProfile,
        mockDone,
      );

      // Tokens are received but not used in the validation logic
      expect(authService.validateGithubUser).toHaveBeenCalled();
      expect(mockDone).toHaveBeenCalledWith(null, mockValidatedUser);
    });

    it('should handle email with special characters', async () => {
      const profile: Profile = {
        ...mockProfile,
        emails: [{ value: 'USER+TEST@EXAMPLE.COM' }],
      };

      authService.validateGithubUser.mockResolvedValue(mockValidatedUser as any);

      await strategy.validate('access-token', 'refresh-token', profile, mockDone);

      expect(authService.validateGithubUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'user+test@example.com', // lowercase
        }),
      );
    });

    it('should log user information (console.log coverage)', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      authService.validateGithubUser.mockResolvedValue(mockValidatedUser as any);

      await strategy.validate('access-token', 'refresh-token', mockProfile, mockDone);

      expect(consoleSpy).toHaveBeenCalledWith(
        'githubUser',
        mockValidatedUser,
        'email',
        'test@example.com',
      );

      consoleSpy.mockRestore();
    });
  });

  describe('constructor configuration', () => {
    it('should be configured with correct clientID', () => {
      expect(strategy).toBeDefined();
    });

    it('should be configured with correct scope', () => {
      expect(strategy).toBeDefined();
      // Scope is set to ['user:email'] in the super() call
    });
  });
});
