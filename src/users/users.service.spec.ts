import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Services } from 'src/utils/constants';

describe('UsersService', () => {
  let service: UsersService;
  let prismaService: PrismaService;

  // Mock PrismaService
  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
    },
    follow: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: Services.PRISMA,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prismaService = module.get<PrismaService>(Services.PRISMA);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('followUser', () => {
    const followerId = 1;
    const followingId = 2;
    const mockUser = {
      id: followingId,
      email: 'test@example.com',
      username: 'testuser',
      password: 'hashedpassword',
      is_verified: true,
      provider_id: null,
      role: 'USER',
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
    };
    const mockFollow = {
      followerId,
      followingId,
      createdAt: new Date(),
    };

    it('should successfully create a follow relationship', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.follow.findUnique.mockResolvedValue(null);
      mockPrismaService.follow.create.mockResolvedValue(mockFollow);

      const result = await service.followUser(followerId, followingId);

      expect(result).toEqual(mockFollow);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: followingId },
      });
      expect(mockPrismaService.follow.findUnique).toHaveBeenCalledWith({
        where: {
          followerId_followingId: {
            followerId,
            followingId,
          },
        },
      });
      expect(mockPrismaService.follow.create).toHaveBeenCalledWith({
        data: {
          followerId,
          followingId,
        },
      });
    });

    it('should throw ConflictException when trying to follow yourself', async () => {
      await expect(service.followUser(1, 1)).rejects.toThrow(ConflictException);
      await expect(service.followUser(1, 1)).rejects.toThrow('You cannot follow yourself');

      expect(mockPrismaService.user.findUnique).not.toHaveBeenCalled();
      expect(mockPrismaService.follow.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when user to follow does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.followUser(followerId, followingId)).rejects.toThrow(NotFoundException);
      await expect(service.followUser(followerId, followingId)).rejects.toThrow(
        'User to follow not found',
      );

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: followingId },
      });
      expect(mockPrismaService.follow.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when already following the user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.follow.findUnique.mockResolvedValue(mockFollow);

      await expect(service.followUser(followerId, followingId)).rejects.toThrow(ConflictException);
      await expect(service.followUser(followerId, followingId)).rejects.toThrow(
        'You are already following this user',
      );

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: followingId },
      });
      expect(mockPrismaService.follow.findUnique).toHaveBeenCalledWith({
        where: {
          followerId_followingId: {
            followerId,
            followingId,
          },
        },
      });
      expect(mockPrismaService.follow.create).not.toHaveBeenCalled();
    });
  });

  describe('unfollowUser', () => {
    const followerId = 1;
    const followingId = 2;
    const mockFollow = {
      followerId,
      followingId,
      createdAt: new Date(),
    };

    it('should successfully delete a follow relationship', async () => {
      mockPrismaService.follow.findUnique.mockResolvedValue(mockFollow);
      mockPrismaService.follow.delete.mockResolvedValue(mockFollow);

      const result = await service.unfollowUser(followerId, followingId);

      expect(result).toEqual(mockFollow);
      expect(mockPrismaService.follow.findUnique).toHaveBeenCalledWith({
        where: {
          followerId_followingId: {
            followerId,
            followingId,
          },
        },
      });
      expect(mockPrismaService.follow.delete).toHaveBeenCalledWith({
        where: {
          followerId_followingId: {
            followerId,
            followingId,
          },
        },
      });
    });

    it('should throw ConflictException when trying to unfollow yourself', async () => {
      await expect(service.unfollowUser(1, 1)).rejects.toThrow(ConflictException);
      await expect(service.unfollowUser(1, 1)).rejects.toThrow('You cannot unfollow yourself');

      expect(mockPrismaService.follow.findUnique).not.toHaveBeenCalled();
      expect(mockPrismaService.follow.delete).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when not following the user', async () => {
      mockPrismaService.follow.findUnique.mockResolvedValue(null);

      await expect(service.unfollowUser(followerId, followingId)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.unfollowUser(followerId, followingId)).rejects.toThrow(
        'You are not following this user',
      );

      expect(mockPrismaService.follow.findUnique).toHaveBeenCalledWith({
        where: {
          followerId_followingId: {
            followerId,
            followingId,
          },
        },
      });
      expect(mockPrismaService.follow.delete).not.toHaveBeenCalled();
    });
  });
});
