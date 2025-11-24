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
