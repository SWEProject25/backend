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
      count: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
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

  describe('getFollowers', () => {
    const userId = 1;
    const page = 1;
    const limit = 10;

    const mockFollowers = [
      {
        followerId: 2,
        followingId: userId,
        createdAt: new Date('2025-10-23T10:00:00.000Z'),
        Follower: {
          id: 2,
          username: 'follower1',
          Profile: {
            name: 'Follower One',
            bio: 'Bio of follower 1',
            profile_image_url: 'https://example.com/image1.jpg',
          },
        },
      },
      {
        followerId: 3,
        followingId: userId,
        createdAt: new Date('2025-10-23T09:00:00.000Z'),
        Follower: {
          id: 3,
          username: 'follower2',
          Profile: {
            name: 'Follower Two',
            bio: null,
            profile_image_url: null,
          },
        },
      },
    ];

    it('should successfully retrieve paginated followers', async () => {
      const totalItems = 2;
      mockPrismaService.$transaction.mockResolvedValue([totalItems, mockFollowers]);

      const result = await service.getFollowers(userId, page, limit);

      expect(result).toEqual({
        data: [
          {
            id: 2,
            username: 'follower1',
            displayName: 'Follower One',
            bio: 'Bio of follower 1',
            profileImageUrl: 'https://example.com/image1.jpg',
            followedAt: new Date('2025-10-23T10:00:00.000Z'),
          },
          {
            id: 3,
            username: 'follower2',
            displayName: 'Follower Two',
            bio: null,
            profileImageUrl: null,
            followedAt: new Date('2025-10-23T09:00:00.000Z'),
          },
        ],
        metadata: {
          totalItems: 2,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      });

      expect(mockPrismaService.$transaction).toHaveBeenCalledWith([
        expect.objectContaining({
          // count query
        }),
        expect.objectContaining({
          // findMany query
        }),
      ]);
    });

    it('should return empty array when no followers exist', async () => {
      mockPrismaService.$transaction.mockResolvedValue([0, []]);

      const result = await service.getFollowers(userId, page, limit);

      expect(result).toEqual({
        data: [],
        metadata: {
          totalItems: 0,
          page: 1,
          limit: 10,
          totalPages: 0,
        },
      });
    });

    it('should calculate correct pagination metadata', async () => {
      const totalItems = 25;
      mockPrismaService.$transaction.mockResolvedValue([totalItems, mockFollowers]);

      const result = await service.getFollowers(userId, 2, 10);

      expect(result.metadata).toEqual({
        totalItems: 25,
        page: 2,
        limit: 10,
        totalPages: 3,
      });
    });
  });

  describe('getFollowing', () => {
    const userId = 1;
    const page = 1;
    const limit = 10;

    const mockFollowing = [
      {
        followerId: userId,
        followingId: 2,
        createdAt: new Date('2025-10-23T10:00:00.000Z'),
        Following: {
          id: 2,
          username: 'following1',
          Profile: {
            name: 'Following One',
            bio: 'Bio of following 1',
            profile_image_url: 'https://example.com/image1.jpg',
          },
        },
      },
      {
        followerId: userId,
        followingId: 3,
        createdAt: new Date('2025-10-23T09:00:00.000Z'),
        Following: {
          id: 3,
          username: 'following2',
          Profile: {
            name: null,
            bio: 'Bio of following 2',
            profile_image_url: null,
          },
        },
      },
    ];

    it('should successfully retrieve paginated following users', async () => {
      const totalItems = 2;
      mockPrismaService.$transaction.mockResolvedValue([totalItems, mockFollowing]);

      const result = await service.getFollowing(userId, page, limit);

      expect(result).toEqual({
        data: [
          {
            id: 2,
            username: 'following1',
            displayName: 'Following One',
            bio: 'Bio of following 1',
            profileImageUrl: 'https://example.com/image1.jpg',
            followedAt: new Date('2025-10-23T10:00:00.000Z'),
          },
          {
            id: 3,
            username: 'following2',
            displayName: null,
            bio: 'Bio of following 2',
            profileImageUrl: null,
            followedAt: new Date('2025-10-23T09:00:00.000Z'),
          },
        ],
        metadata: {
          totalItems: 2,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      });

      expect(mockPrismaService.$transaction).toHaveBeenCalledWith([
        expect.objectContaining({
          // count query
        }),
        expect.objectContaining({
          // findMany query
        }),
      ]);
    });

    it('should return empty array when not following anyone', async () => {
      mockPrismaService.$transaction.mockResolvedValue([0, []]);

      const result = await service.getFollowing(userId, page, limit);

      expect(result).toEqual({
        data: [],
        metadata: {
          totalItems: 0,
          page: 1,
          limit: 10,
          totalPages: 0,
        },
      });
    });

    it('should use default pagination values', async () => {
      mockPrismaService.$transaction.mockResolvedValue([2, mockFollowing]);

      const result = await service.getFollowing(userId);

      expect(result.metadata.page).toBe(1);
      expect(result.metadata.limit).toBe(10);
    });
  });
});
