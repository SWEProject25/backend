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
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    follow: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    block: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    mute: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: Services.PRISMA,
          useValue: mockPrismaService,
        },
        {
          provide: Services.REDIS,
          useValue: mockRedisService,
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
        select: { id: true },
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
      mockPrismaService.follow.findUnique.mockResolvedValue(null);

      await expect(service.followUser(followerId, followingId)).rejects.toThrow(NotFoundException);
      await expect(service.followUser(followerId, followingId)).rejects.toThrow('User not found');

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: followingId },
        select: { id: true },
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
        select: { id: true },
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

      // Mock the follow relationship query for isFollowedByMe
      mockPrismaService.follow.findMany.mockResolvedValue([
        { followingId: 2 }, // userId is following follower1
      ]);

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
            is_followed_by_me: true,
          },
          {
            id: 3,
            username: 'follower2',
            displayName: 'Follower Two',
            bio: null,
            profileImageUrl: null,
            followedAt: new Date('2025-10-23T09:00:00.000Z'),
            is_followed_by_me: false,
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

      // Verify the follow relationship query was called
      expect(mockPrismaService.follow.findMany).toHaveBeenCalledWith({
        where: {
          followerId: userId,
          followingId: { in: [2, 3] },
        },
        select: { followingId: true },
      });
    });

    it('should return empty array when no followers exist', async () => {
      mockPrismaService.$transaction.mockResolvedValue([0, []]);

      // Mock empty follow relationship query
      mockPrismaService.follow.findMany.mockResolvedValue([]);

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

      // Mock follow relationship query
      mockPrismaService.follow.findMany.mockResolvedValue([]);

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

  describe('blockUser', () => {
    const blockerId = 1;
    const blockedId = 2;
    const mockUser = { id: blockedId };
    const mockBlock = {
      id: 1,
      blockerId,
      blockedId,
      createdAt: new Date(),
    };

    it('should successfully block a user when not following', async () => {
      // Mock Promise.all responses: [user exists, no existing block, no existing follow]
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.block.findUnique.mockResolvedValue(null);
      mockPrismaService.follow.findUnique.mockResolvedValue(null);
      mockPrismaService.block.create.mockResolvedValue(mockBlock);

      const result = await service.blockUser(blockerId, blockedId);

      expect(result).toEqual(mockBlock);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: blockedId },
        select: { id: true },
      });
      expect(mockPrismaService.block.findUnique).toHaveBeenCalledWith({
        where: {
          blockerId_blockedId: {
            blockerId,
            blockedId,
          },
        },
      });
      expect(mockPrismaService.follow.findUnique).toHaveBeenCalledWith({
        where: {
          followerId_followingId: {
            followerId: blockerId,
            followingId: blockedId,
          },
        },
      });
      expect(mockPrismaService.block.create).toHaveBeenCalledWith({
        data: {
          blockerId,
          blockedId,
        },
      });
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('should successfully block a user and unfollow in transaction when following', async () => {
      const mockFollow = { followerId: blockerId, followingId: blockedId };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.block.findUnique.mockResolvedValue(null);
      mockPrismaService.follow.findUnique.mockResolvedValue(mockFollow);
      mockPrismaService.$transaction.mockResolvedValue([mockFollow, mockBlock]);

      const result = await service.blockUser(blockerId, blockedId);

      expect(result).toEqual(mockBlock);
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should throw ConflictException when trying to block yourself', async () => {
      await expect(service.blockUser(1, 1)).rejects.toThrow(ConflictException);
      await expect(service.blockUser(1, 1)).rejects.toThrow('You cannot block yourself');

      expect(mockPrismaService.user.findUnique).not.toHaveBeenCalled();
      expect(mockPrismaService.block.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when user to block does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.block.findUnique.mockResolvedValue(null);
      mockPrismaService.follow.findUnique.mockResolvedValue(null);

      await expect(service.blockUser(blockerId, blockedId)).rejects.toThrow(NotFoundException);
      await expect(service.blockUser(blockerId, blockedId)).rejects.toThrow('User not found');

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: blockedId },
        select: { id: true },
      });
      expect(mockPrismaService.block.create).not.toHaveBeenCalled();
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when already blocked', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.block.findUnique.mockResolvedValue(mockBlock);
      mockPrismaService.follow.findUnique.mockResolvedValue(null);

      await expect(service.blockUser(blockerId, blockedId)).rejects.toThrow(ConflictException);
      await expect(service.blockUser(blockerId, blockedId)).rejects.toThrow(
        'You have already blocked this user',
      );

      expect(mockPrismaService.block.create).not.toHaveBeenCalled();
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('unblockUser', () => {
    const blockerId = 1;
    const blockedId = 2;
    const mockBlock = {
      id: 1,
      blockerId,
      blockedId,
      createdAt: new Date(),
    };

    it('should successfully unblock a user', async () => {
      mockPrismaService.block.findUnique.mockResolvedValue(mockBlock);
      mockPrismaService.block.delete.mockResolvedValue(mockBlock);

      const result = await service.unblockUser(blockerId, blockedId);

      expect(result).toEqual(mockBlock);
      expect(mockPrismaService.block.findUnique).toHaveBeenCalledWith({
        where: {
          blockerId_blockedId: {
            blockerId,
            blockedId,
          },
        },
      });
      expect(mockPrismaService.block.delete).toHaveBeenCalledWith({
        where: {
          blockerId_blockedId: {
            blockerId,
            blockedId,
          },
        },
      });
    });

    it('should throw ConflictException when trying to unblock yourself', async () => {
      await expect(service.unblockUser(1, 1)).rejects.toThrow(ConflictException);
      await expect(service.unblockUser(1, 1)).rejects.toThrow('You cannot unblock yourself');

      expect(mockPrismaService.block.findUnique).not.toHaveBeenCalled();
      expect(mockPrismaService.block.delete).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when user is not blocked', async () => {
      mockPrismaService.block.findUnique.mockResolvedValue(null);

      await expect(service.unblockUser(blockerId, blockedId)).rejects.toThrow(ConflictException);
      await expect(service.unblockUser(blockerId, blockedId)).rejects.toThrow(
        'You have not blocked this user',
      );

      expect(mockPrismaService.block.findUnique).toHaveBeenCalledWith({
        where: {
          blockerId_blockedId: {
            blockerId,
            blockedId,
          },
        },
      });
      expect(mockPrismaService.block.delete).not.toHaveBeenCalled();
    });
  });

  describe('getBlockedUsers', () => {
    const userId = 1;
    const page = 1;
    const limit = 10;

    const mockBlockedUsers = [
      {
        id: 1,
        blockerId: userId,
        blockedId: 2,
        createdAt: new Date('2025-10-23T10:00:00.000Z'),
        Blocked: {
          id: 2,
          username: 'blocked1',
          Profile: {
            name: 'Blocked One',
            bio: 'Bio of blocked user 1',
            profile_image_url: 'https://example.com/blocked1.jpg',
          },
        },
      },
      {
        id: 2,
        blockerId: userId,
        blockedId: 3,
        createdAt: new Date('2025-10-23T09:00:00.000Z'),
        Blocked: {
          id: 3,
          username: 'blocked2',
          Profile: {
            name: null,
            bio: null,
            profile_image_url: null,
          },
        },
      },
    ];

    it('should successfully retrieve paginated blocked users', async () => {
      const totalItems = 2;
      mockPrismaService.$transaction.mockResolvedValue([totalItems, mockBlockedUsers]);

      const result = await service.getBlockedUsers(userId, page, limit);

      expect(result).toEqual({
        data: [
          {
            id: 2,
            username: 'blocked1',
            displayName: 'Blocked One',
            bio: 'Bio of blocked user 1',
            profileImageUrl: 'https://example.com/blocked1.jpg',
            blockedAt: new Date('2025-10-23T10:00:00.000Z'),
          },
          {
            id: 3,
            username: 'blocked2',
            displayName: null,
            bio: null,
            profileImageUrl: null,
            blockedAt: new Date('2025-10-23T09:00:00.000Z'),
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

    it('should return empty array when no blocked users exist', async () => {
      mockPrismaService.$transaction.mockResolvedValue([0, []]);

      const result = await service.getBlockedUsers(userId, page, limit);

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
      mockPrismaService.$transaction.mockResolvedValue([totalItems, mockBlockedUsers]);

      const result = await service.getBlockedUsers(userId, 2, 10);

      expect(result.metadata).toEqual({
        totalItems: 25,
        page: 2,
        limit: 10,
        totalPages: 3,
      });
    });

    it('should use default pagination values', async () => {
      mockPrismaService.$transaction.mockResolvedValue([2, mockBlockedUsers]);

      const result = await service.getBlockedUsers(userId);

      expect(result.metadata.page).toBe(1);
      expect(result.metadata.limit).toBe(10);
    });

    it('should handle users with no profile data', async () => {
      const blockedUsersNoProfile = [
        {
          id: 1,
          blockerId: userId,
          blockedId: 2,
          createdAt: new Date('2025-10-23T10:00:00.000Z'),
          Blocked: {
            id: 2,
            username: 'blocked1',
            Profile: null,
          },
        },
      ];

      mockPrismaService.$transaction.mockResolvedValue([1, blockedUsersNoProfile]);

      const result = await service.getBlockedUsers(userId, page, limit);

      expect(result.data[0]).toEqual({
        id: 2,
        username: 'blocked1',
        displayName: null,
        bio: null,
        profileImageUrl: null,
        blockedAt: new Date('2025-10-23T10:00:00.000Z'),
      });
    });
  });

  describe('muteUser', () => {
    const muterId = 1;
    const mutedId = 2;
    const mockUser = { id: mutedId };
    const mockMute = {
      id: 1,
      muterId,
      mutedId,
      createdAt: new Date(),
    };

    it('should successfully mute a user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.mute.findUnique.mockResolvedValue(null);
      mockPrismaService.mute.create.mockResolvedValue(mockMute);

      const result = await service.muteUser(muterId, mutedId);

      expect(result).toEqual(mockMute);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: mutedId },
        select: { id: true },
      });
      expect(mockPrismaService.mute.findUnique).toHaveBeenCalledWith({
        where: {
          muterId_mutedId: {
            muterId,
            mutedId,
          },
        },
      });
      expect(mockPrismaService.mute.create).toHaveBeenCalledWith({
        data: {
          muterId,
          mutedId,
        },
      });
    });

    it('should throw ConflictException when trying to mute yourself', async () => {
      await expect(service.muteUser(1, 1)).rejects.toThrow(ConflictException);
      await expect(service.muteUser(1, 1)).rejects.toThrow('You cannot mute yourself');

      expect(mockPrismaService.user.findUnique).not.toHaveBeenCalled();
      expect(mockPrismaService.mute.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when user to mute does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.mute.findUnique.mockResolvedValue(null);

      await expect(service.muteUser(muterId, mutedId)).rejects.toThrow(NotFoundException);
      await expect(service.muteUser(muterId, mutedId)).rejects.toThrow('User not found');

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: mutedId },
        select: { id: true },
      });
      expect(mockPrismaService.mute.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when already muted', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.mute.findUnique.mockResolvedValue(mockMute);

      await expect(service.muteUser(muterId, mutedId)).rejects.toThrow(ConflictException);
      await expect(service.muteUser(muterId, mutedId)).rejects.toThrow(
        'You have already muted this user',
      );

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: mutedId },
        select: { id: true },
      });
      expect(mockPrismaService.mute.findUnique).toHaveBeenCalledWith({
        where: {
          muterId_mutedId: {
            muterId,
            mutedId,
          },
        },
      });
      expect(mockPrismaService.mute.create).not.toHaveBeenCalled();
    });
  });

  describe('unmuteUser', () => {
    const muterId = 1;
    const mutedId = 2;
    const mockMute = {
      id: 1,
      muterId,
      mutedId,
      createdAt: new Date(),
    };

    it('should successfully unmute a user', async () => {
      mockPrismaService.mute.findUnique.mockResolvedValue(mockMute);
      mockPrismaService.mute.delete.mockResolvedValue(mockMute);

      const result = await service.unmuteUser(muterId, mutedId);

      expect(result).toEqual(mockMute);
      expect(mockPrismaService.mute.findUnique).toHaveBeenCalledWith({
        where: {
          muterId_mutedId: {
            muterId,
            mutedId,
          },
        },
      });
      expect(mockPrismaService.mute.delete).toHaveBeenCalledWith({
        where: {
          muterId_mutedId: {
            muterId,
            mutedId,
          },
        },
      });
    });

    it('should throw ConflictException when trying to unmute yourself', async () => {
      await expect(service.unmuteUser(1, 1)).rejects.toThrow(ConflictException);
      await expect(service.unmuteUser(1, 1)).rejects.toThrow('You cannot unmute yourself');

      expect(mockPrismaService.mute.findUnique).not.toHaveBeenCalled();
      expect(mockPrismaService.mute.delete).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when user is not muted', async () => {
      mockPrismaService.mute.findUnique.mockResolvedValue(null);

      await expect(service.unmuteUser(muterId, mutedId)).rejects.toThrow(ConflictException);
      await expect(service.unmuteUser(muterId, mutedId)).rejects.toThrow(
        'You have not muted this user',
      );

      expect(mockPrismaService.mute.findUnique).toHaveBeenCalledWith({
        where: {
          muterId_mutedId: {
            muterId,
            mutedId,
          },
        },
      });
      expect(mockPrismaService.mute.delete).not.toHaveBeenCalled();
    });
  });

  describe('getMutedUsers', () => {
    const userId = 1;
    const page = 1;
    const limit = 10;

    const mockMutedUsers = [
      {
        id: 1,
        muterId: userId,
        mutedId: 2,
        createdAt: new Date('2025-10-23T10:00:00.000Z'),
        Muted: {
          id: 2,
          username: 'muted1',
          Profile: {
            name: 'Muted One',
            bio: 'Bio of muted user 1',
            profile_image_url: 'https://example.com/muted1.jpg',
          },
        },
      },
      {
        id: 2,
        muterId: userId,
        mutedId: 3,
        createdAt: new Date('2025-10-23T09:00:00.000Z'),
        Muted: {
          id: 3,
          username: 'muted2',
          Profile: {
            name: null,
            bio: null,
            profile_image_url: null,
          },
        },
      },
    ];

    it('should successfully retrieve paginated muted users', async () => {
      const totalItems = 2;
      mockPrismaService.$transaction.mockResolvedValue([totalItems, mockMutedUsers]);

      const result = await service.getMutedUsers(userId, page, limit);

      expect(result).toEqual({
        data: [
          {
            id: 2,
            username: 'muted1',
            displayName: 'Muted One',
            bio: 'Bio of muted user 1',
            profileImageUrl: 'https://example.com/muted1.jpg',
            mutedAt: new Date('2025-10-23T10:00:00.000Z'),
          },
          {
            id: 3,
            username: 'muted2',
            displayName: null,
            bio: null,
            profileImageUrl: null,
            mutedAt: new Date('2025-10-23T09:00:00.000Z'),
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

    it('should return empty array when no muted users exist', async () => {
      mockPrismaService.$transaction.mockResolvedValue([0, []]);

      const result = await service.getMutedUsers(userId, page, limit);

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
      mockPrismaService.$transaction.mockResolvedValue([totalItems, mockMutedUsers]);

      const result = await service.getMutedUsers(userId, 2, 10);

      expect(result.metadata).toEqual({
        totalItems: 25,
        page: 2,
        limit: 10,
        totalPages: 3,
      });
    });

    it('should use default pagination values', async () => {
      mockPrismaService.$transaction.mockResolvedValue([2, mockMutedUsers]);

      const result = await service.getMutedUsers(userId);

      expect(result.metadata.page).toBe(1);
      expect(result.metadata.limit).toBe(10);
    });

    it('should handle users with no profile data', async () => {
      const mutedUsersNoProfile = [
        {
          id: 1,
          muterId: userId,
          mutedId: 2,
          createdAt: new Date('2025-10-23T10:00:00.000Z'),
          Muted: {
            id: 2,
            username: 'muted1',
            Profile: null,
          },
        },
      ];

      mockPrismaService.$transaction.mockResolvedValue([1, mutedUsersNoProfile]);

      const result = await service.getMutedUsers(userId, page, limit);

      expect(result.data[0]).toEqual({
        id: 2,
        username: 'muted1',
        displayName: null,
        bio: null,
        profileImageUrl: null,
        mutedAt: new Date('2025-10-23T10:00:00.000Z'),
      });
    });
  });
});
