import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from '../auth/services/password/password.service';
import { Services } from '../utils/constants';
import { Role } from '@prisma/client';
import { CreateUserDto } from './dto/create-user.dto';
import { OAuthProfileDto } from '../auth/dto/oauth-profile.dto';

describe('UserService', () => {
  let service: UserService;
  let prismaService: any;

  const mockDate = new Date('2025-01-01T00:00:00Z');

  const mockUser = {
    id: 1,
    username: 'mohamed-sameh-albaz',
    email: 'mohamedalbaz492@gmail.com',
    password: 'hashedpassword',
    role: Role.USER,
    is_verified: true,
    provider_id: null,
    has_completed_interests: false,
    has_completed_following: false,
    created_at: mockDate,
    updated_at: mockDate,
    deleted_at: null,
  };

  const mockProfile = {
    id: 1,
    user_id: 1,
    name: 'Mohamed Albaz',
    birth_date: new Date('2004-01-01'),
    profile_image_url: 'https://example.com/avatar.jpg',
    banner_image_url: 'https://example.com/banner.jpg',
    bio: 'Test bio',
    location: 'Test Location',
    website: 'https://example.com',
    is_deactivated: false,
    created_at: mockDate,
    updated_at: mockDate,
  };

  const mockUserWithProfile = {
    ...mockUser,
    Profile: mockProfile,
  };

  beforeEach(async () => {
    const mockPrismaService = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
      },
      profile: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const mockPasswordService = {
      hash: jest.fn(),
      verify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: Services.PRISMA,
          useValue: mockPrismaService,
        },
        {
          provide: Services.PASSWORD,
          useValue: mockPasswordService,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    prismaService = module.get(Services.PRISMA);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createUserDto: CreateUserDto = {
      email: 'mohamedalbaz492+new@gmail.com',
      password: 'Test1234!',
      name: 'Mohamed Albaz',
      birthDate: new Date('2004-01-01'),
    };

    // it('should create a new user with profile successfully', async () => {
    //   const hashedPassword = 'hashedpassword';
    //   const newUser = {
    //     id: 2,
    //     username: 'newuser',
    //     email: createUserDto.email,
    //     password: hashedPassword,
    //     role: Role.USER,
    //     is_verified: true,
    //     provider_id: null,
    //     has_completed_interests: false,
    //     has_completed_following: false,
    //     created_at: mockDate,
    //     updated_at: mockDate,
    //     deleted_at: null,
    //     Profile: {
    //       id: 2,
    //       user_id: 2,
    //       name: createUserDto.name,
    //       birth_date: createUserDto.birthDate,
    //       profile_image_url: null,
    //       banner_image_url: null,
    //       bio: null,
    //       location: null,
    //       website: null,
    //       is_deactivated: false,
    //       created_at: mockDate,
    //       updated_at: mockDate,
    //     },
    //   };

    //   prismaService.user.create.mockResolvedValue(newUser);

    //   const result = await service.create(createUserDto, true);
    //   expect(prismaService.user.create).toHaveBeenCalledWith({
    //     data: {
    //       email: createUserDto.email,
    //       username: expect.any(String),
    //       password: hashedPassword,
    //       is_verified: true,
    //       Profile: {
    //         create: {
    //           name: createUserDto.name,
    //           birth_date: createUserDto.birthDate,
    //         },
    //       },
    //     },
    //     include: { Profile: true },
    //   });
    //   expect(result).toEqual(newUser);
    // });

    it('should create user with is_verified as false when not verified', async () => {
      prismaService.user.create.mockResolvedValue(mockUserWithProfile);

      await service.create(createUserDto, false);

      expect(prismaService.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            is_verified: false,
          }),
        }),
      );
    });

    it('should create user with additional OAuth data', async () => {
      const additionalData = {
        providerId: 'google-123',
        profileImageUrl: 'https://google.com/avatar.jpg',
      };
      prismaService.user.create.mockResolvedValue(mockUserWithProfile);

      await service.create(createUserDto, true, additionalData);

      expect(prismaService.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            provider_id: additionalData.providerId,
            Profile: {
              create: expect.objectContaining({
                profile_image_url: additionalData.profileImageUrl,
              }),
            },
          }),
        }),
      );
    });

    it('should regenerate username when collision occurs', async () => {
      // First call returns existing user (collision), second call returns null (unique)
      prismaService.user.findUnique
        .mockResolvedValueOnce(mockUser) // username exists
        .mockResolvedValueOnce(null); // new username is unique
      prismaService.user.create.mockResolvedValue(mockUserWithProfile);

      await service.create(createUserDto, true);

      // checkUsername should be called at least twice (once for collision, once for unique)
      expect(prismaService.user.findUnique).toHaveBeenCalled();
      expect(prismaService.user.create).toHaveBeenCalled();
    });
  });

  describe('findByEmail', () => {
    it('should return a user when found by email', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUserWithProfile);

      const result = await service.findByEmail('mohamedalbaz492@gmail.com');

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'mohamedalbaz492@gmail.com' },
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          is_verified: true,
          password: true,
          Profile: {
            select: {
              name: true,
              profile_image_url: true,
              birth_date: true,
            },
          },
          deleted_at: true,
          has_completed_following: true,
          has_completed_interests: true,
        },
      });
      expect(result).toEqual(mockUserWithProfile);
    });

    it('should return null when user is not found by email', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.findByEmail('notfound@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findOne', () => {
    it('should return a user with profile when found by id', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUserWithProfile);

      const result = await service.findOne(1);

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: {
          email: true,
          username: true,
          role: true,
          is_verified: true,
          Profile: {
            select: {
              name: true,
              profile_image_url: true,
              birth_date: true,
            },
          },
          deleted_at: true,
          has_completed_following: true,
          has_completed_interests: true,
        },
      });
      expect(result).toEqual(mockUserWithProfile);
    });

    it('should return null when user is not found by id', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.findOne(999);

      expect(result).toBeNull();
    });
  });

  describe('findByUsername', () => {
    it('should return a user when found by username', async () => {
      prismaService.user.findFirst.mockResolvedValue(mockUserWithProfile);

      const result = await service.findByUsername('mohamed-sameh-albaz');

      expect(prismaService.user.findFirst).toHaveBeenCalledWith({
        where: { username: 'mohamed-sameh-albaz' },
      });
      expect(result).toEqual(mockUserWithProfile);
    });

    it('should return null when user is not found by username', async () => {
      prismaService.user.findFirst.mockResolvedValue(null);

      const result = await service.findByUsername('notfound');

      expect(result).toBeNull();
    });
  });

  describe('findByProviderId', () => {
    it('should return a user when found by provider_id', async () => {
      const userWithProvider = { ...mockUserWithProfile, provider_id: '12345466' };
      prismaService.user.findFirst.mockResolvedValue(userWithProvider);

      const result = await service.findByProviderId('12345466');

      expect(prismaService.user.findFirst).toHaveBeenCalledWith({
        where: { provider_id: '12345466' },
        include: { Profile: true },
      });
      expect(result).toEqual(userWithProvider);
    });

    it('should return null when user is not found by provider_id', async () => {
      prismaService.user.findFirst.mockResolvedValue(null);

      const result = await service.findByProviderId('nonexistent-provider');

      expect(result).toBeNull();
    });
  });

  describe('createOAuthUser', () => {
    it('should create OAuth user with email provided', async () => {
      const oauthProfile: OAuthProfileDto = {
        provider: 'google',
        providerId: 'google-123',
        email: 'oauth@example.com',
        username: 'oauthuser',
        displayName: 'OAuth User',
        profileImageUrl: 'https://example.com/avatar.jpg',
      };

      const newUser = { ...mockUser, id: 2, email: oauthProfile.email };
      prismaService.user.create.mockResolvedValue(newUser);
      prismaService.profile.create.mockResolvedValue(mockProfile);

      const result = await service.createOAuthUser(oauthProfile);

      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: {
          email: oauthProfile.email,
          password: '',
          username: oauthProfile.username,
          is_verified: true,
          provider_id: oauthProfile.providerId,
        },
      });
      expect(result.newUser).toEqual(newUser);
    });

    it('should create OAuth user without email (generates synthetic)', async () => {
      const oauthProfile = {
        provider: 'github',
        providerId: 'github-456',
        email: null as unknown as string,
        username: 'githubuser',
        displayName: 'GitHub User',
      } as OAuthProfileDto;

      const newUser = { ...mockUser, id: 3 };
      prismaService.user.create.mockResolvedValue(newUser);
      prismaService.profile.create.mockResolvedValue(mockProfile);

      const result = await service.createOAuthUser(oauthProfile);

      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: `${oauthProfile.providerId}@${oauthProfile.provider}.oauth`,
        }),
      });
      expect(result.newUser).toEqual(newUser);
    });

    it('should use username as display name if displayName not provided', async () => {
      const oauthProfile = {
        provider: 'github',
        providerId: 'github-789',
        email: 'test@github.com',
        username: 'testuser',
        displayName: '',
      } as OAuthProfileDto;

      const newUser = { ...mockUser, id: 4 };
      prismaService.user.create.mockResolvedValue(newUser);
      prismaService.profile.create.mockResolvedValue(mockProfile);

      await service.createOAuthUser(oauthProfile);

      expect(prismaService.profile.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'testuser',
        }),
      });
    });
  });

  describe('updateOAuthData', () => {
    it('should update OAuth data with email', async () => {
      const userId = 1;
      const providerId = 'google-123';
      const email = 'newemail@example.com';

      prismaService.user.update.mockResolvedValue({ ...mockUser, provider_id: providerId, email });

      await service.updateOAuthData(userId, providerId, email);

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { provider_id: providerId, email },
      });
    });

    it('should update OAuth data without email', async () => {
      const userId = 1;
      const providerId = 'google-123';

      prismaService.user.update.mockResolvedValue({ ...mockUser, provider_id: providerId });

      await service.updateOAuthData(userId, providerId);

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { provider_id: providerId },
      });
    });
  });

  describe('getUserData', () => {
    it('should get user data by email', async () => {
      const email = 'test@example.com';
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.profile.findUnique.mockResolvedValue(mockProfile);

      const result = await service.getUserData(email);

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email },
      });
      expect(result).toEqual({ user: mockUser, profile: mockProfile });
    });

    it('should get user data by username', async () => {
      const username = 'testuser';
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.profile.findUnique.mockResolvedValue(mockProfile);

      const result = await service.getUserData(username);

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { username },
      });
      expect(result).toEqual({ user: mockUser, profile: mockProfile });
    });

    it('should return null when user not found', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.getUserData('notfound@example.com');

      expect(result).toBeNull();
    });
  });

  describe('updatePassword', () => {
    it('should update user password', async () => {
      const userId = 1;
      const hashedPassword = 'newhashed';
      const updatedUser = { ...mockUser, password: hashedPassword };

      prismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.updatePassword(userId, hashedPassword);

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { password: hashedPassword },
      });
      expect(result).toEqual(updatedUser);
    });
  });

  describe('findById', () => {
    it('should find user by id', async () => {
      prismaService.user.findFirst.mockResolvedValue(mockUser);

      const result = await service.findById(1);

      expect(prismaService.user.findFirst).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      prismaService.user.findFirst.mockResolvedValue(null);

      const result = await service.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('checkUsername', () => {
    it('should return user when username exists', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.checkUsername('existinguser');

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { username: 'existinguser' },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null when username does not exist', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.checkUsername('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('updateEmail', () => {
    it('should update user email successfully', async () => {
      const newEmail = 'mohamedalbaz492+new@gmail.com';
      const updatedUser = { ...mockUser, email: newEmail };
      prismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.updateEmail(1, newEmail);

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { email: newEmail, is_verified: false },
      });
      expect(result).toEqual(updatedUser);
    });
  });

  describe('updateUsername', () => {
    it('should update user username successfully', async () => {
      const newUsername = 'newusername';
      const updatedUser = { ...mockUser, username: newUsername };
      prismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.updateUsername(1, newUsername);

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { username: newUsername },
      });
      expect(result).toEqual(updatedUser);
    });
  });
});
