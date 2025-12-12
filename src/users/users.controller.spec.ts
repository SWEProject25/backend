import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { Services } from 'src/utils/constants';
import { AuthenticatedUser } from 'src/auth/interfaces/user.interface';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;

  // Mock UsersService
  const mockUsersService = {
    followUser: jest.fn(),
    unfollowUser: jest.fn(),
    getFollowers: jest.fn(),
    getFollowing: jest.fn(),
    getFollowersYouKnow: jest.fn(),
    blockUser: jest.fn(),
    unblockUser: jest.fn(),
    getBlockedUsers: jest.fn(),
    muteUser: jest.fn(),
    unmuteUser: jest.fn(),
    getMutedUsers: jest.fn(),
    getSuggestedUsers: jest.fn(),
    getUserInterests: jest.fn(),
    saveUserInterests: jest.fn(),
    getAllInterests: jest.fn(),
  };

  // Mock authenticated user
  const mockUser: AuthenticatedUser = {
    id: 1,
    email: 'test@example.com',
    username: 'testuser',
    is_verified: true,
    provider_id: null,
    role: 'USER',
    has_completed_interests: false,
    has_completed_following: false,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: Services.USERS,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(Services.USERS);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('followUser', () => {
    const followingId = 2;
    const mockFollow = {
      followerId: mockUser.id,
      followingId,
      createdAt: new Date(),
    };

    it('should successfully follow a user', async () => {
      mockUsersService.followUser.mockResolvedValue(mockFollow);

      const result = await controller.followUser(followingId, mockUser);

      expect(result).toEqual({
        status: 'success',
        message: 'User followed successfully',
        data: mockFollow,
      });
      expect(service.followUser).toHaveBeenCalledWith(mockUser.id, followingId);
      expect(service.followUser).toHaveBeenCalledTimes(1);
    });

    it('should throw ConflictException when trying to follow yourself', async () => {
      mockUsersService.followUser.mockRejectedValue(
        new ConflictException('You cannot follow yourself'),
      );

      await expect(controller.followUser(mockUser.id, mockUser)).rejects.toThrow(ConflictException);
      expect(service.followUser).toHaveBeenCalledWith(mockUser.id, mockUser.id);
    });

    it('should throw NotFoundException when user to follow does not exist', async () => {
      mockUsersService.followUser.mockRejectedValue(
        new NotFoundException('User to follow not found'),
      );

      await expect(controller.followUser(followingId, mockUser)).rejects.toThrow(NotFoundException);
      expect(service.followUser).toHaveBeenCalledWith(mockUser.id, followingId);
    });

    it('should throw ConflictException when already following the user', async () => {
      mockUsersService.followUser.mockRejectedValue(
        new ConflictException('You are already following this user'),
      );

      await expect(controller.followUser(followingId, mockUser)).rejects.toThrow(ConflictException);
      expect(service.followUser).toHaveBeenCalledWith(mockUser.id, followingId);
    });
  });

  describe('unfollowUser', () => {
    const unfollowingId = 2;
    const mockUnfollow = {
      followerId: mockUser.id,
      followingId: unfollowingId,
      createdAt: new Date(),
    };

    it('should successfully unfollow a user', async () => {
      mockUsersService.unfollowUser.mockResolvedValue(mockUnfollow);

      const result = await controller.unfollowUser(unfollowingId, mockUser);

      expect(result).toEqual({
        status: 'success',
        message: 'User unfollowed successfully',
        data: mockUnfollow,
      });
      expect(service.unfollowUser).toHaveBeenCalledWith(mockUser.id, unfollowingId);
      expect(service.unfollowUser).toHaveBeenCalledTimes(1);
    });

    it('should throw ConflictException when trying to unfollow yourself', async () => {
      mockUsersService.unfollowUser.mockRejectedValue(
        new ConflictException('You cannot unfollow yourself'),
      );

      await expect(controller.unfollowUser(mockUser.id, mockUser)).rejects.toThrow(
        ConflictException,
      );
      expect(service.unfollowUser).toHaveBeenCalledWith(mockUser.id, mockUser.id);
    });

    it('should throw ConflictException when not following the user', async () => {
      mockUsersService.unfollowUser.mockRejectedValue(
        new ConflictException('You are not following this user'),
      );

      await expect(controller.unfollowUser(unfollowingId, mockUser)).rejects.toThrow(
        ConflictException,
      );
      expect(service.unfollowUser).toHaveBeenCalledWith(mockUser.id, unfollowingId);
    });
  });

  describe('getFollowers', () => {
    const userId = 123;
    const mockPaginationQuery = { page: 1, limit: 10 };
    const mockResult = {
      data: [
        {
          id: 456,
          username: 'follower1',
          displayName: 'Follower One',
          bio: 'Bio text',
          profileImageUrl: 'https://example.com/image.jpg',
          followedAt: new Date('2025-10-23T10:00:00.000Z'),
        },
      ],
      metadata: {
        totalItems: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      },
    };

    it('should successfully get followers with default pagination', async () => {
      mockUsersService.getFollowers.mockResolvedValue(mockResult);

      const result = await controller.getFollowers(userId, mockPaginationQuery, mockUser);

      expect(result).toEqual({
        status: 'success',
        message: 'Followers retrieved successfully',
        data: mockResult.data,
        metadata: mockResult.metadata,
      });
      expect(service.getFollowers).toHaveBeenCalledWith(userId, 1, 10, mockUser.id);
    });
  });

  describe('getFollowing', () => {
    const userId = 123;
    const mockPaginationQuery = { page: 1, limit: 10 };
    const mockResult = {
      data: [{ id: 789, username: 'following1' }],
      metadata: { totalItems: 1, page: 1, limit: 10, totalPages: 1 },
    };

    it('should successfully get following users', async () => {
      mockUsersService.getFollowing.mockResolvedValue(mockResult);

      const result = await controller.getFollowing(userId, mockPaginationQuery, mockUser);

      expect(result).toEqual({
        status: 'success',
        message: 'Following users retrieved successfully',
        data: mockResult.data,
        metadata: mockResult.metadata,
      });
      expect(service.getFollowing).toHaveBeenCalledWith(userId, 1, 10, mockUser.id);
    });
  });

  describe('getFollowersYouKnow', () => {
    const userId = 123;
    const mockPaginationQuery = { page: 1, limit: 10 };
    const mockResult = {
      data: [
        {
          id: 456,
          username: 'mutual1',
          displayName: 'Mutual One',
          is_following_me: true,
        },
      ],
      metadata: { totalItems: 1, page: 1, limit: 10, totalPages: 1 },
    };

    it('should successfully get followers you know', async () => {
      mockUsersService.getFollowersYouKnow.mockResolvedValue(mockResult);

      const result = await controller.getFollowersYouKnow(userId, mockPaginationQuery, mockUser);

      expect(result).toEqual({
        status: 'success',
        message: 'Followers you know retrieved successfully',
        data: mockResult.data,
        metadata: mockResult.metadata,
      });
      expect(service.getFollowersYouKnow).toHaveBeenCalledWith(userId, 1, 10, mockUser.id);
    });

    it('should return empty when no mutual followers exist', async () => {
      const emptyResult = { data: [], metadata: { totalItems: 0, page: 1, limit: 10, totalPages: 0 } };
      mockUsersService.getFollowersYouKnow.mockResolvedValue(emptyResult);

      const result = await controller.getFollowersYouKnow(userId, mockPaginationQuery, mockUser);

      expect(result.data).toEqual([]);
    });
  });

  describe('blockUser', () => {
    const blockedId = 2;
    const mockBlock = { id: 1, blockerId: mockUser.id, blockedId, createdAt: new Date() };

    it('should successfully block a user', async () => {
      mockUsersService.blockUser.mockResolvedValue(mockBlock);

      const result = await controller.blockUser(blockedId, mockUser);

      expect(result).toEqual({ status: 'success', message: 'User blocked successfully' });
      expect(service.blockUser).toHaveBeenCalledWith(mockUser.id, blockedId);
    });
  });

  describe('unblockUser', () => {
    const blockedId = 2;
    const mockBlock = { id: 1, blockerId: mockUser.id, blockedId, createdAt: new Date() };

    it('should successfully unblock a user', async () => {
      mockUsersService.unblockUser.mockResolvedValue(mockBlock);

      const result = await controller.unblockUser(blockedId, mockUser);

      expect(result).toEqual({ status: 'success', message: 'User unblocked successfully' });
      expect(service.unblockUser).toHaveBeenCalledWith(mockUser.id, blockedId);
    });
  });

  describe('getBlockedUsers', () => {
    const mockPaginationQuery = { page: 1, limit: 10 };
    const mockResult = {
      data: [{ id: 456, username: 'blocked1' }],
      metadata: { totalItems: 1, page: 1, limit: 10, totalPages: 1 },
    };

    it('should successfully get blocked users', async () => {
      mockUsersService.getBlockedUsers.mockResolvedValue(mockResult);

      const result = await controller.getBlockedUsers(mockUser, mockPaginationQuery);

      expect(result.status).toBe('success');
      expect(service.getBlockedUsers).toHaveBeenCalledWith(mockUser.id, 1, 10);
    });
  });

  describe('muteUser', () => {
    const mutedId = 2;
    const mockMute = { id: 1, muterId: mockUser.id, mutedId, createdAt: new Date() };

    it('should successfully mute a user', async () => {
      mockUsersService.muteUser.mockResolvedValue(mockMute);

      const result = await controller.muteUser(mutedId, mockUser);

      expect(result).toEqual({ status: 'success', message: 'User muted successfully' });
      expect(service.muteUser).toHaveBeenCalledWith(mockUser.id, mutedId);
    });
  });

  describe('unmuteUser', () => {
    const mutedId = 2;
    const mockMute = { id: 1, muterId: mockUser.id, mutedId, createdAt: new Date() };

    it('should successfully unmute a user', async () => {
      mockUsersService.unmuteUser.mockResolvedValue(mockMute);

      const result = await controller.unmuteUser(mutedId, mockUser);

      expect(result).toEqual({ status: 'success', message: 'User unmuted successfully' });
      expect(service.unmuteUser).toHaveBeenCalledWith(mockUser.id, mutedId);
    });
  });

  describe('getMutedUsers', () => {
    const mockPaginationQuery = { page: 1, limit: 10 };
    const mockResult = {
      data: [{ id: 456, username: 'muted1' }],
      metadata: { totalItems: 1, page: 1, limit: 10, totalPages: 1 },
    };

    it('should successfully get muted users', async () => {
      mockUsersService.getMutedUsers.mockResolvedValue(mockResult);

      const result = await controller.getMutedUsers(mockUser, mockPaginationQuery);

      expect(result.status).toBe('success');
      expect(service.getMutedUsers).toHaveBeenCalledWith(mockUser.id, 1, 10);
    });
  });

  describe('getSuggestedUsers', () => {
    const mockQuery = { limit: 10 };
    const mockSuggestedUsers = [
      { id: 2, username: 'suggested1', email: 'user@test.com', isVerified: true, profile: null, followersCount: 100 },
    ];

    it('should return suggested users for authenticated user', async () => {
      mockUsersService.getSuggestedUsers.mockResolvedValue(mockSuggestedUsers);

      const result = await controller.getSuggestedUsers(mockQuery, mockUser);

      expect(result.status).toBe('success');
      expect(result.data.users).toEqual(mockSuggestedUsers);
      expect(result.total).toBe(1);
      expect(service.getSuggestedUsers).toHaveBeenCalledWith(mockUser.id, 10, true, true);
    });

    it('should return suggested users for unauthenticated user', async () => {
      mockUsersService.getSuggestedUsers.mockResolvedValue(mockSuggestedUsers);

      const result = await controller.getSuggestedUsers(mockQuery, undefined);

      expect(result.status).toBe('success');
      expect(service.getSuggestedUsers).toHaveBeenCalledWith(undefined, 10, false, false);
    });

    it('should return empty message when no suggested users', async () => {
      mockUsersService.getSuggestedUsers.mockResolvedValue([]);

      const result = await controller.getSuggestedUsers(mockQuery, mockUser);

      expect(result.message).toBe('No suggested users available');
      expect(result.total).toBe(0);
    });

    it('should use custom excludeFollowed and excludeBlocked flags', async () => {
      mockUsersService.getSuggestedUsers.mockResolvedValue(mockSuggestedUsers);
      const queryWithFlags = { limit: 5, excludeFollowed: false, excludeBlocked: true };

      await controller.getSuggestedUsers(queryWithFlags, mockUser);

      expect(service.getSuggestedUsers).toHaveBeenCalledWith(mockUser.id, 5, false, true);
    });
  });

  describe('getUserInterests', () => {
    const mockInterests = [
      { id: 1, name: 'Technology', slug: 'technology', icon: '💻', selectedAt: new Date() },
    ];

    it('should return user interests', async () => {
      mockUsersService.getUserInterests.mockResolvedValue(mockInterests);

      const result = await controller.getUserInterests(mockUser);

      expect(result.status).toBe('success');
      expect(result.message).toBe('Successfully retrieved user interests');
      expect(result.data).toEqual(mockInterests);
      expect(result.total).toBe(1);
      expect(service.getUserInterests).toHaveBeenCalledWith(mockUser.id);
    });

    it('should return empty array when user has no interests', async () => {
      mockUsersService.getUserInterests.mockResolvedValue([]);

      const result = await controller.getUserInterests(mockUser);

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('saveUserInterests', () => {
    const mockReq = { user: mockUser };
    const mockDto = { interestIds: [1, 2, 3] };

    it('should save user interests successfully', async () => {
      mockUsersService.saveUserInterests.mockResolvedValue(3);

      const result = await controller.saveUserInterests(mockReq, mockDto);

      expect(result.status).toBe('success');
      expect(result.savedCount).toBe(3);
      expect(service.saveUserInterests).toHaveBeenCalledWith(mockUser.id, [1, 2, 3]);
    });

    it('should throw BadRequestException when interest IDs are invalid', async () => {
      mockUsersService.saveUserInterests.mockRejectedValue(
        new BadRequestException('One or more interest IDs are invalid'),
      );

      await expect(controller.saveUserInterests(mockReq, mockDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when no interests provided', async () => {
      mockUsersService.saveUserInterests.mockRejectedValue(
        new BadRequestException('At least one interest must be selected'),
      );

      await expect(controller.saveUserInterests(mockReq, { interestIds: [] })).rejects.toThrow(BadRequestException);
    });
  });

  describe('getAllInterests', () => {
    const mockInterests = [
      { id: 1, name: 'Technology', slug: 'technology', description: 'Tech stuff', icon: '💻' },
      { id: 2, name: 'Sports', slug: 'sports', description: 'Sports stuff', icon: '⚽' },
    ];

    it('should return all available interests', async () => {
      mockUsersService.getAllInterests.mockResolvedValue(mockInterests);

      const result = await controller.getAllInterests();

      expect(result.status).toBe('success');
      expect(result.message).toBe('Successfully retrieved interests');
      expect(result.total).toBe(2);
      expect(result.data).toEqual(mockInterests);
      expect(service.getAllInterests).toHaveBeenCalled();
    });

    it('should return empty array when no interests exist', async () => {
      mockUsersService.getAllInterests.mockResolvedValue([]);

      const result = await controller.getAllInterests();

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });
  });
});

