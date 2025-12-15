import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { PasswordService } from './services/password/password.service';
import { JwtTokenService } from './services/jwt-token/jwt-token.service';
import { RedisService } from '../redis/redis.service';
import { Services } from '../utils/constants';
import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { OAuthProfileDto } from './dto/oauth-profile.dto';
import { Role } from '@prisma/client';
import googleOauthConfig from './config/google-oauth.config';

describe('AuthService', () => {
  let service: AuthService;
  let userService: jest.Mocked<UserService>;
  let passwordService: jest.Mocked<PasswordService>;
  let jwtTokenService: jest.Mocked<JwtTokenService>;
  let redisService: jest.Mocked<RedisService>;

  const mockUser = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    password: 'hashedpassword',
    role: Role.USER,
    is_verified: true,
    provider_id: null,
    has_completed_interests: true,
    has_completed_following: true,
    created_at: new Date('2025-01-01T00:00:00Z'),
    updated_at: new Date('2025-01-01T00:00:00Z'),
    deleted_at: null,
    Profile: {
      id: 1,
      user_id: 1,
      name: 'Test User',
      birth_date: new Date('1990-01-01'),
      profile_image_url: 'https://example.com/avatar.jpg',
      banner_image_url: 'https://example.com/banner.jpg',
      bio: 'Test bio',
      location: 'Test Location',
      website: 'https://example.com',
      is_deactivated: false,
      created_at: new Date('2025-01-01T00:00:00Z'),
      updated_at: new Date('2025-01-01T00:00:00Z'),
    },
  };

  const mockUserService = {
    findByEmail: jest.fn(),
    findOne: jest.fn(),
    findByUsername: jest.fn(),
    findByProviderId: jest.fn(),
    getUserData: jest.fn(),
    create: jest.fn(),
    createOAuthUser: jest.fn(),
    updateOAuthData: jest.fn(),
    updateEmail: jest.fn(),
    updateUsername: jest.fn(),
  };

  const mockPasswordService = {
    verify: jest.fn(),
  };

  const mockJwtSercivce = {
    generateAccessToken: jest.fn(),
  };

  const mockRedisService = {
    get: jest.fn(),
    del: jest.fn(),
    setJSON: jest.fn(),
    getJSON: jest.fn(),
  };

  const mockGoogleOAuthConfig = {
    clientID: 'test-client-id',
    clientSecret: 'test-client-secret',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: Services.USER,
          useValue: mockUserService,
        },
        {
          provide: Services.PASSWORD,
          useValue: mockPasswordService,
        },
        {
          provide: Services.JWT_TOKEN,
          useValue: mockJwtSercivce,
        },
        {
          provide: Services.REDIS,
          useValue: mockRedisService,
        },
        {
          provide: googleOauthConfig.KEY,
          useValue: mockGoogleOAuthConfig,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userService = module.get(Services.USER);
    passwordService = module.get(Services.PASSWORD);
    jwtTokenService = module.get(Services.JWT_TOKEN);
    redisService = module.get(Services.REDIS);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('registerUser', () => {
    const createUserDto: CreateUserDto = {
      email: 'mohamedalbaz492@gmail.com',
      password: 'Test1234!',
      name: 'Mohamed Albaz',
      birthDate: new Date('2004-01-01'),
    };

    it('should register a new user successfully when email is verified', async () => {
      userService.findByEmail.mockResolvedValue(null);
      redisService.get.mockResolvedValue('true');
      userService.create.mockResolvedValue(mockUser as any);

      const result = await service.registerUser(createUserDto);

      expect(userService.findByEmail).toHaveBeenCalledWith(createUserDto.email);
      expect(redisService.get).toHaveBeenCalledWith(`verified:${createUserDto.email}`);
      expect(userService.create).toHaveBeenCalledWith(createUserDto, true);
      expect(redisService.del).toHaveBeenCalledWith(`verified:${createUserDto.email}`);
      expect(result).toEqual(mockUser);
    });

    it('should throw BadRequestException when birthDate is not provided', async () => {
      const dtoWithoutBirthDate: CreateUserDto = {
        email: 'test@example.com',
        password: 'Password123!',
        name: 'Test User',
      };

      await expect(service.registerUser(dtoWithoutBirthDate)).rejects.toThrow(BadRequestException);
      await expect(service.registerUser(dtoWithoutBirthDate)).rejects.toThrow(
        'Birth date is required for signup',
      );
      expect(userService.findByEmail).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when user already exists', async () => {
      userService.findByEmail.mockResolvedValue(mockUser as any);

      await expect(service.registerUser(createUserDto)).rejects.toThrow(ConflictException);
      await expect(service.registerUser(createUserDto)).rejects.toThrow('User is already exists');
      expect(redisService.get).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when email is not verified', async () => {
      userService.findByEmail.mockResolvedValue(null);
      redisService.get.mockResolvedValue(null);

      await expect(service.registerUser(createUserDto)).rejects.toThrow(BadRequestException);
      await expect(service.registerUser(createUserDto)).rejects.toThrow(
        'Account is not verified, please verify the email first',
      );
      expect(userService.create).not.toHaveBeenCalled();
    });

    it('should delete verification token from Redis after successful registration', async () => {
      userService.findByEmail.mockResolvedValue(null);
      redisService.get.mockResolvedValue('true');
      userService.create.mockResolvedValue(mockUser as any);

      await service.registerUser(createUserDto);

      expect(redisService.del).toHaveBeenCalledWith(`verified:${createUserDto.email}`);
      expect(redisService.del).toHaveBeenCalledTimes(1);
    });
  });

  describe('checkEmailExistence', () => {
    it('should pass successfully when email does not exist', async () => {
      userService.findByEmail.mockResolvedValue(null);

      await expect(service.checkEmailExistence('mohamedalbaz492@gmail.com')).resolves.not.toThrow();
      expect(userService.findByEmail).toHaveBeenCalledWith('mohamedalbaz492@gmail.com');
    });

    it('should throw ConflictException when email already exists', async () => {
      userService.findByEmail.mockResolvedValue(mockUser as any);

      await expect(service.checkEmailExistence('mohamedalbaz492@gmail.com')).rejects.toThrow(
        ConflictException,
      );
      await expect(service.checkEmailExistence('mohamedalbaz492@gmail.com')).rejects.toThrow(
        'User already exists with this email',
      );
    });
  });

  describe('login', () => {
    const accessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';

    it('should return user data and access token on successful login', async () => {
      userService.findOne.mockResolvedValue(mockUser as any);
      jwtTokenService.generateAccessToken.mockResolvedValue(accessToken);

      const result = await service.login(mockUser.id, mockUser.username);

      expect(userService.findOne).toHaveBeenCalledWith(mockUser.id);
      expect(jwtTokenService.generateAccessToken).toHaveBeenCalledWith(
        mockUser.id,
        mockUser.username,
      );
      expect(result).toEqual({
        user: {
          id: mockUser.id,
          username: mockUser.username,
          email: mockUser.email,
          role: mockUser.role,
          profile: {
            name: mockUser.Profile.name,
            profileImageUrl: mockUser.Profile.profile_image_url,
          },
        },
        onboarding: {
          hasCompeletedFollowing: true,
          hasCompeletedInterests: true,
          hasCompletedBirthDate: true,
        },
        accessToken,
      });
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      userService.findOne.mockResolvedValue(null);

      await expect(service.login(999, 'noUser')).rejects.toThrow(UnauthorizedException);
      await expect(service.login(999, 'noUser')).rejects.toThrow('User not found');
      expect(jwtTokenService.generateAccessToken).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when account is deleted', async () => {
      const deletedUser = {
        ...mockUser,
        deleted_at: new Date('2025-11-024T00:00:00Z'),
      };
      userService.findOne.mockResolvedValue(deletedUser as any);

      await expect(service.login(mockUser.id, mockUser.username)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(mockUser.id, mockUser.username)).rejects.toThrow(
        'Account has been deleted',
      );
      expect(jwtTokenService.generateAccessToken).not.toHaveBeenCalled();
    });

    it('should return false for hasCompletedBirthDate when birthDate is null for onboarding flow', async () => {
      const userWithoutProfile = {
        ...mockUser,
        Profile: {
          ...mockUser.Profile,
          birth_date: null,
        },
      };
      userService.findOne.mockResolvedValue(userWithoutProfile as any);
      jwtTokenService.generateAccessToken.mockResolvedValue(accessToken);

      const result = await service.login(mockUser.id, mockUser.username);
      expect(result.onboarding.hasCompletedBirthDate).toBe(false);
    });
  });

  describe('validateLocalUser', () => {
    it('should return auth payload for valid credentials in request.user', async () => {
      userService.findByEmail.mockResolvedValue(mockUser as any);
      passwordService.verify.mockResolvedValue(true);

      const result = await service.validateLocalUser(mockUser.email, 'correctpassword');

      expect(userService.findByEmail).toHaveBeenCalledWith(mockUser.email);
      expect(passwordService.verify).toHaveBeenCalledWith(mockUser.password, 'correctpassword');
      expect(result).toEqual({
        sub: mockUser.id,
        username: mockUser.username,
        role: mockUser.role,
        email: mockUser.email,
        profileImageUrl: mockUser.Profile.profile_image_url,
      });
    });

    it('should throw UnauthorizedException when user does not exist', async () => {
      userService.findByEmail.mockResolvedValue(null);

      await expect(
        service.validateLocalUser('mohamedalbaz492@gmail.com', 'password'),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.validateLocalUser('mohamedalbaz492@gmail.com', 'password'),
      ).rejects.toThrow('Invalid credentials');
      expect(passwordService.verify).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when account is deleted', async () => {
      const deletedUser = {
        ...mockUser,
        deleted_at: new Date('2025-11-24T00:00:00Z'),
      };
      userService.findByEmail.mockResolvedValue(deletedUser as any);

      await expect(service.validateLocalUser(mockUser.email, 'password')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.validateLocalUser(mockUser.email, 'password')).rejects.toThrow(
        'Account has been deleted',
      );
      expect(passwordService.verify).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when email is not verified', async () => {
      const unverifiedUser = { ...mockUser, is_verified: false };
      userService.findByEmail.mockResolvedValue(unverifiedUser as any);

      await expect(service.validateLocalUser(mockUser.email, 'password')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.validateLocalUser(mockUser.email, 'password')).rejects.toThrow(
        'Please verify your email before logging in',
      );
      expect(passwordService.verify).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when password is invalid', async () => {
      userService.findByEmail.mockResolvedValue(mockUser as any);
      passwordService.verify.mockResolvedValue(false);

      await expect(service.validateLocalUser(mockUser.email, 'wrongpassword')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.validateLocalUser(mockUser.email, 'wrongpassword')).rejects.toThrow(
        'Invalid credentials',
      );
    });
  });

  describe('validateUserJwt', () => {
    it('should return user data for valid JWT', async () => {
      userService.findOne.mockResolvedValue(mockUser as any);

      const result = await service.validateUserJwt(mockUser.id);

      expect(userService.findOne).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual({
        id: mockUser.id,
        username: mockUser.username,
        role: mockUser.role,
        email: mockUser.email,
        name: mockUser.Profile.name,
        profileImageUrl: mockUser.Profile.profile_image_url,
      });
    });

    it('should throw UnauthorizedException when user does not exist', async () => {
      userService.findOne.mockResolvedValue(null);

      await expect(service.validateUserJwt(999)).rejects.toThrow(UnauthorizedException);
      await expect(service.validateUserJwt(999)).rejects.toThrow('Invalid Credentials');
    });

    it('should throw UnauthorizedException when account is deleted', async () => {
      const deletedUser = {
        ...mockUser,
        deleted_at: new Date('2025-11-24T00:00:00Z'),
      };
      userService.findOne.mockResolvedValue(deletedUser as any);

      await expect(service.validateUserJwt(mockUser.id)).rejects.toThrow(UnauthorizedException);
      await expect(service.validateUserJwt(mockUser.id)).rejects.toThrow(
        'Account has been deleted',
      );
    });
  });

  describe('validateGoogleUser', () => {
    const googleUser: OAuthProfileDto = {
      provider: 'google',
      providerId: '108318052268079221395',
      username: 'mohamed-sameh-albaz',
      displayName: 'Mohamed Albaz',
      email: 'mohamedalbaz492@gmail.com',
      profileImageUrl: 'https://avatars.githubusercontent.com/u/136837275',
    };

    it('should return existing user when found by email', async () => {
      userService.findByEmail.mockResolvedValue(mockUser as any);

      const result = await service.validateGoogleUser(googleUser);

      expect(userService.findByEmail).toHaveBeenCalledWith(googleUser.email);
      expect(result).toEqual(mockUser);
      expect(userService.create).not.toHaveBeenCalled();
    });

    it('should create new user when not found by email', async () => {
      const newUser = {
        id: 2,
        username: 'mohamedalbaz',
        email: googleUser.email,
        password: '',
        role: Role.USER,
        is_verified: true,
        provider_id: googleUser.providerId,
        has_completed_interests: false,
        has_completed_following: false,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        Profile: {
          id: 2,
          user_id: 2,
          name: googleUser.displayName,
          profile_image_url: googleUser.profileImageUrl,
          birth_date: null,
          banner_image_url: null,
          bio: null,
          location: null,
          website: null,
          is_deactivated: false,
          created_at: new Date(),
          updated_at: new Date(),
        },
      };

      userService.findByEmail.mockResolvedValue(null);
      userService.create.mockResolvedValue(newUser as any);

      const result = await service.validateGoogleUser(googleUser);

      expect(userService.create).toHaveBeenCalledWith(
        {
          email: googleUser.email,
          name: googleUser.displayName,
          password: '',
        },
        true,
        {
          providerId: googleUser.providerId,
          profileImageUrl: googleUser.profileImageUrl,
          profileUrl: googleUser.profileUrl,
          provider: googleUser.provider,
          username: googleUser.username,
        },
      );
      expect(result).toEqual({
        sub: newUser.id,
        username: newUser.username,
        role: newUser.role,
        email: newUser.email,
        name: newUser.Profile.name,
        profileImageUrl: newUser.Profile.profile_image_url,
      });
    });
  });

  describe('validateGithubUser', () => {
    const githubUser: OAuthProfileDto = {
      provider: 'github',
      providerId: '136837275',
      username: 'mohamed-sameh-albaz',
      displayName: 'Mohamed Sameh Albaz',
      email: 'mohamedalbaz492@gmail.com',
      profileImageUrl: 'https://avatars.githubusercontent.com/u/136837275?v=4',
      profileUrl: 'https://github.com/mohamed-sameh-albaz',
    };

    it('should return existing user when found by provider_id', async () => {
      const userWithProviderId = {
        ...mockUser,
        provider_id: githubUser.providerId,
      };
      userService.findByProviderId.mockResolvedValue(userWithProviderId as any);

      const result = await service.validateGithubUser(githubUser);

      expect(userService.findByProviderId).toHaveBeenCalledWith(githubUser.providerId);
      expect(result).toEqual({
        sub: userWithProviderId.id,
        username: userWithProviderId.username,
        role: userWithProviderId.role,
        email: userWithProviderId.email,
        name: userWithProviderId.Profile.name,
        profileImageUrl: userWithProviderId.Profile.profile_image_url,
      });
      expect(userService.getUserData).not.toHaveBeenCalled();
    });

    it('should not update OAuth data if provider_id already exists when found by email', async () => {
      const userWithProvider = {
        ...mockUser,
        provider_id: '136837275',
      };
      userService.findByProviderId.mockResolvedValue(null);
      userService.getUserData.mockResolvedValue({
        user: userWithProvider,
        profile: mockUser.Profile,
      } as any);

      await service.validateGithubUser(githubUser);

      expect(userService.updateOAuthData).not.toHaveBeenCalled();
    });

    it('should create new user when not found', async () => {
      const newOAuthUser = {
        newUser: {
          id: 3,
          username: 'mohamed-sameh-albaz',
          email: githubUser.email,
          password: '',
          role: Role.USER,
          is_verified: true,
          provider_id: githubUser.providerId,
          has_completed_interests: false,
          has_completed_following: false,
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
        },
        proflie: {
          id: 3,
          user_id: 3,
          name: githubUser.displayName,
          profile_image_url: githubUser.profileImageUrl,
          birth_date: null,
          banner_image_url: null,
          bio: null,
          location: null,
          website: null,
          is_deactivated: false,
          created_at: new Date(),
          updated_at: new Date(),
        },
      };

      userService.findByProviderId.mockResolvedValue(null);
      userService.getUserData.mockResolvedValue(null);
      userService.createOAuthUser.mockResolvedValue(newOAuthUser as any);

      const result = await service.validateGithubUser(githubUser);

      expect(userService.createOAuthUser).toHaveBeenCalledWith(githubUser);
      expect(result).toEqual({
        sub: newOAuthUser.newUser.id,
        username: newOAuthUser.newUser.username,
        role: newOAuthUser.newUser.role,
        email: newOAuthUser.newUser.email,
        name: newOAuthUser.proflie.name,
        profileImageUrl: newOAuthUser.proflie.profile_image_url,
      });
    });
  });

  describe('updateEmail', () => {
    const newEmail = 'mohamedalbaz492+new@gmail.com';

    it('should update email successfully when email is not taken by another user', async () => {
      userService.findByEmail.mockResolvedValue(null);

      await service.updateEmail(mockUser.id, newEmail);

      expect(userService.findByEmail).toHaveBeenCalledWith(newEmail);
      expect(userService.updateEmail).toHaveBeenCalledWith(mockUser.id, newEmail);
    });

    it('should throw ConflictException when email is used by another user', async () => {
      const anotherUser = { ...mockUser, id: 999 };
      userService.findByEmail.mockResolvedValue(anotherUser as any);

      await expect(service.updateEmail(mockUser.id, 'mohamedalbaz492@gmail.com')).rejects.toThrow(
        ConflictException,
      );
      await expect(service.updateEmail(mockUser.id, 'mohamedalbaz492@gmail.com')).rejects.toThrow(
        'Email is already in use by another user',
      );
      expect(userService.updateEmail).not.toHaveBeenCalled();
    });
  });

  describe('updateUsername', () => {
    const newUsername = 'newUniqueUsername';

    it('should update username successfully when username is not taken', async () => {
      userService.findByUsername.mockResolvedValue(null);

      await service.updateUsername(mockUser.id, newUsername);

      expect(userService.findByUsername).toHaveBeenCalledWith(newUsername);
      expect(userService.updateUsername).toHaveBeenCalledWith(mockUser.id, newUsername);
    });

    it('should throw ConflictException when username is taken by another user', async () => {
      const anotherUser = { ...mockUser, id: 999, username: 'takenusername' };
      userService.findByUsername.mockResolvedValue(anotherUser as any);

      await expect(service.updateUsername(mockUser.id, 'takenusername')).rejects.toThrow(
        ConflictException,
      );
      await expect(service.updateUsername(mockUser.id, 'takenusername')).rejects.toThrow(
        'Username is already taken',
      );
      expect(userService.updateUsername).not.toHaveBeenCalled();
    });

    it('should allow user to update to same username they already have', async () => {
      const sameUser = { ...mockUser, username: 'existingUsername' };
      userService.findByUsername.mockResolvedValue(sameUser as any);

      await service.updateUsername(mockUser.id, 'existingUsername');

      expect(userService.updateUsername).toHaveBeenCalledWith(mockUser.id, 'existingUsername');
    });
  });

  describe('verifyGoogleIdToken', () => {
    const validIdToken = 'valid-google-id-token';
    const accessToken = 'access-token-123';

    it('should verify Google ID token and return user data with access token', async () => {
      const googlePayload = {
        sub: '108318052268079221395',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/photo.jpg',
      };

      // Mock the Google OAuth client
      const mockVerifyIdToken = jest.fn().mockResolvedValue({
        getPayload: () => googlePayload,
      });
      (service as any).googleClient = {
        verifyIdToken: mockVerifyIdToken,
      };

      userService.findByEmail.mockResolvedValue(mockUser as any);
      userService.findOne.mockResolvedValue(mockUser as any);
      jwtTokenService.generateAccessToken.mockResolvedValue(accessToken);

      const result = await service.verifyGoogleIdToken(validIdToken);

      expect(mockVerifyIdToken).toHaveBeenCalledWith({
        idToken: validIdToken,
        audience: mockGoogleOAuthConfig.clientID,
      });
      expect(result).toHaveProperty('accessToken', accessToken);
      expect(result).toHaveProperty('result');
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      const mockVerifyIdToken = jest.fn().mockRejectedValue(new Error('Invalid token'));
      (service as any).googleClient = {
        verifyIdToken: mockVerifyIdToken,
      };

      await expect(service.verifyGoogleIdToken('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.verifyGoogleIdToken('invalid-token')).rejects.toThrow(
        'Invalid Google ID token',
      );
    });

    it('should throw UnauthorizedException when payload is null', async () => {
      const mockVerifyIdToken = jest.fn().mockResolvedValue({
        getPayload: () => null,
      });
      (service as any).googleClient = {
        verifyIdToken: mockVerifyIdToken,
      };

      await expect(service.verifyGoogleIdToken(validIdToken)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.verifyGoogleIdToken(validIdToken)).rejects.toThrow(
        'Invalid Google ID token',
      );
    });

    it('should create OAuth profile from Google payload', async () => {
      const googlePayload = {
        sub: '12345',
        email: 'newuser@example.com',
        name: 'New User',
        picture: 'https://example.com/photo.jpg',
      };

      const mockVerifyIdToken = jest.fn().mockResolvedValue({
        getPayload: () => googlePayload,
      });
      (service as any).googleClient = {
        verifyIdToken: mockVerifyIdToken,
      };

      const newUser = {
        id: 5,
        username: 'newuser',
        email: googlePayload.email,
        password: '',
        role: Role.USER,
        is_verified: true,
        provider_id: googlePayload.sub,
        has_completed_interests: false,
        has_completed_following: false,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        Profile: {
          id: 5,
          user_id: 5,
          name: googlePayload.name,
          profile_image_url: googlePayload.picture,
          birth_date: null,
          banner_image_url: null,
          bio: null,
          location: null,
          website: null,
          is_deactivated: false,
          created_at: new Date(),
          updated_at: new Date(),
        },
      };

      userService.findByEmail.mockResolvedValue(null);
      userService.create.mockResolvedValue(newUser as any);
      userService.findOne.mockResolvedValue(newUser as any);
      jwtTokenService.generateAccessToken.mockResolvedValue(accessToken);

      const result = await service.verifyGoogleIdToken(validIdToken);

      expect(result).toBeDefined();
      expect(result.accessToken).toBe(accessToken);
    });
  });

  describe('validateGithubUser - additional edge cases', () => {
    const githubUser: OAuthProfileDto = {
      provider: 'github',
      providerId: '136837275',
      username: 'testuser',
      displayName: 'Test User',
      email: 'test@example.com',
      profileImageUrl: 'https://example.com/avatar.jpg',
      profileUrl: 'https://github.com/testuser',
    };

    it('should link GitHub OAuth to existing account when found by email without provider_id', async () => {
      const userWithoutProvider = {
        ...mockUser,
        provider_id: null,
      };

      userService.findByProviderId.mockResolvedValue(null);
      userService.getUserData.mockResolvedValueOnce({
        user: userWithoutProvider,
        profile: mockUser.Profile,
      } as any);

      const result = await service.validateGithubUser(githubUser);

      expect(userService.updateOAuthData).toHaveBeenCalledWith(
        userWithoutProvider.id,
        githubUser.providerId,
        githubUser.email,
      );
      expect(result).toEqual({
        sub: userWithoutProvider.id,
        username: userWithoutProvider.username,
        role: userWithoutProvider.role,
        email: userWithoutProvider.email,
        name: mockUser.Profile.name,
        profileImageUrl: mockUser.Profile.profile_image_url,
      });
    });

    it('should find user by username when email not provided', async () => {
      const { email, ...githubUserNoEmail } = githubUser;

      userService.findByProviderId.mockResolvedValue(null);
      userService.getUserData.mockResolvedValueOnce(null);
      userService.getUserData.mockResolvedValueOnce({
        user: mockUser,
        profile: mockUser.Profile,
      } as any);

      const result = await service.validateGithubUser(githubUserNoEmail as OAuthProfileDto);

      expect(userService.getUserData).toHaveBeenCalledWith(githubUser.username);
      expect(result).toBeDefined();
    });

    it('should update provider_id when user found by username without provider_id', async () => {
      const userWithoutProvider = {
        ...mockUser,
        provider_id: null,
      };

      userService.findByProviderId.mockResolvedValue(null);
      userService.getUserData.mockResolvedValueOnce(null);
      userService.getUserData.mockResolvedValueOnce({
        user: userWithoutProvider,
        profile: mockUser.Profile,
      } as any);

      const result = await service.validateGithubUser(githubUser);

      expect(userService.updateOAuthData).toHaveBeenCalledWith(
        userWithoutProvider.id,
        githubUser.providerId,
        githubUser.email,
      );
      expect(result).toEqual({
        sub: userWithoutProvider.id,
        username: userWithoutProvider.username,
        role: userWithoutProvider.role,
        email: userWithoutProvider.email,
        name: mockUser.Profile.name,
        profileImageUrl: mockUser.Profile.profile_image_url,
      });
    });
  });

  describe('updateEmail - additional tests', () => {
    it('should allow user to update to same email they already have', async () => {
      const sameUser = { ...mockUser, email: 'existing@example.com' };
      userService.findByEmail.mockResolvedValue(sameUser as any);

      await service.updateEmail(mockUser.id, 'existing@example.com');

      expect(userService.updateEmail).toHaveBeenCalledWith(mockUser.id, 'existing@example.com');
    });
  });

  describe('login - additional edge cases', () => {
    const accessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';

    it('should return null profile when user has no Profile', async () => {
      const userWithoutProfile = {
        ...mockUser,
        Profile: null,
      };
      userService.findOne.mockResolvedValue(userWithoutProfile as any);
      jwtTokenService.generateAccessToken.mockResolvedValue(accessToken);

      const result = await service.login(mockUser.id, mockUser.username);

      expect(result.user.profile).toBeNull();
    });
  });

  describe('validateUserJwt - additional edge cases', () => {
    it('should return null profile fields when user has no Profile', async () => {
      const userWithoutProfile = {
        ...mockUser,
        Profile: null,
      };
      userService.findOne.mockResolvedValue(userWithoutProfile as any);

      const result = await service.validateUserJwt(mockUser.id);

      expect(result.name).toBeUndefined();
      expect(result.profileImageUrl).toBeUndefined();
    });
  });

  describe('createOAuthCode', () => {
    const accessToken = 'test-access-token';
    const userData = { id: 1, username: 'testuser', email: 'test@example.com' };

    beforeEach(() => {
      redisService.setJSON.mockResolvedValue(undefined);
    });

    it('should create OAuth code and store in Redis', async () => {
      const code = await service.createOAuthCode(accessToken, userData);

      expect(code).toBeDefined();
      expect(typeof code).toBe('string');
      expect(code.length).toBe(64); // 32 bytes = 64 hex characters
      expect(redisService.setJSON).toHaveBeenCalledWith(
        `oauth:code:${code}`,
        {
          accessToken,
          user: userData,
          createdAt: expect.any(Number),
        },
        300, // 5 minutes
      );
    });

    it('should generate unique codes', async () => {
      const code1 = await service.createOAuthCode(accessToken, userData);
      const code2 = await service.createOAuthCode(accessToken, userData);

      expect(code1).not.toBe(code2);
    });

    it('should include timestamp in stored data', async () => {
      const beforeTime = Date.now();
      await service.createOAuthCode(accessToken, userData);
      const afterTime = Date.now();

      const callArgs = redisService.setJSON.mock.calls[0];
      const storedData = callArgs[1] as any;

      expect(storedData.createdAt).toBeGreaterThanOrEqual(beforeTime);
      expect(storedData.createdAt).toBeLessThanOrEqual(afterTime);
    });

    it('should set correct expiry time', async () => {
      await service.createOAuthCode(accessToken, userData);

      const callArgs = redisService.setJSON.mock.calls[0];
      const expiry = callArgs[2];

      expect(expiry).toBe(300); // 5 minutes
    });
  });

  describe('exchangeCode', () => {
    const code = 'test-oauth-code-123';
    const codeData = {
      accessToken: 'test-access-token',
      user: { id: 1, username: 'testuser', email: 'test@example.com' },
      createdAt: Date.now(),
    };

    beforeEach(() => {
      redisService.del.mockResolvedValue(1);
    });

    it('should exchange code for data and delete from Redis', async () => {
      redisService.getJSON.mockResolvedValue(codeData);

      const result = await service.exchangeCode(code);

      expect(redisService.getJSON).toHaveBeenCalledWith(`oauth:code:${code}`);
      expect(redisService.del).toHaveBeenCalledWith(`oauth:code:${code}`);
      expect(result).toEqual(codeData);
    });

    it('should throw UnauthorizedException when code not found', async () => {
      redisService.getJSON.mockResolvedValue(null);

      await expect(service.exchangeCode(code)).rejects.toThrow(UnauthorizedException);
      await expect(service.exchangeCode(code)).rejects.toThrow('Invalid or expired OAuth code');
      expect(redisService.del).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when code is invalid', async () => {
      redisService.getJSON.mockResolvedValue(undefined);

      await expect(service.exchangeCode('invalid-code')).rejects.toThrow(UnauthorizedException);
    });

    it('should delete code after successful exchange', async () => {
      redisService.getJSON.mockResolvedValue(codeData);

      await service.exchangeCode(code);

      expect(redisService.del).toHaveBeenCalledTimes(1);
      expect(redisService.del).toHaveBeenCalledWith(`oauth:code:${code}`);
    });

    it('should handle multiple exchange attempts for same code', async () => {
      redisService.getJSON.mockResolvedValueOnce(codeData).mockResolvedValueOnce(null);

      // First exchange should succeed
      const result1 = await service.exchangeCode(code);
      expect(result1).toEqual(codeData);

      // Second exchange should fail
      await expect(service.exchangeCode(code)).rejects.toThrow(UnauthorizedException);
    });
  });
});
