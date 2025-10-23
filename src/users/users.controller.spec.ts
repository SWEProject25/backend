import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { Services } from 'src/utils/constants';
import { AuthenticatedUser } from 'src/auth/interfaces/user.interface';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;

  // Mock UsersService
  const mockUsersService = {
    followUser: jest.fn(),
    unfollowUser: jest.fn(),
    getFollowers: jest.fn(),
    getFollowing: jest.fn(),
  };

  // Mock authenticated user
  const mockUser: AuthenticatedUser = {
    id: 1,
    email: 'test@example.com',
    username: 'testuser',
    is_verified: true,
    provider_id: null,
    role: 'USER',
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

      const result = await controller.getFollowers(userId, mockPaginationQuery);

      expect(result).toEqual({
        status: 'success',
        message: 'Followers retrieved successfully',
        data: mockResult.data,
        metadata: mockResult.metadata,
      });
      expect(service.getFollowers).toHaveBeenCalledWith(userId, 1, 10);
      expect(service.getFollowers).toHaveBeenCalledTimes(1);
    });

    it('should successfully get followers with custom pagination', async () => {
      const customPagination = { page: 2, limit: 5 };
      const customResult = {
        ...mockResult,
        metadata: { totalItems: 15, page: 2, limit: 5, totalPages: 3 },
      };
      mockUsersService.getFollowers.mockResolvedValue(customResult);

      const result = await controller.getFollowers(userId, customPagination);

      expect(result).toEqual({
        status: 'success',
        message: 'Followers retrieved successfully',
        data: customResult.data,
        metadata: customResult.metadata,
      });
      expect(service.getFollowers).toHaveBeenCalledWith(userId, 2, 5);
    });

    it('should return empty data when user has no followers', async () => {
      const emptyResult = {
        data: [],
        metadata: { totalItems: 0, page: 1, limit: 10, totalPages: 0 },
      };
      mockUsersService.getFollowers.mockResolvedValue(emptyResult);

      const result = await controller.getFollowers(userId, mockPaginationQuery);

      expect(result.data).toEqual([]);
      expect(result.metadata.totalItems).toBe(0);
    });
  });

  describe('getFollowing', () => {
    const userId = 123;
    const mockPaginationQuery = { page: 1, limit: 10 };
    const mockResult = {
      data: [
        {
          id: 789,
          username: 'following1',
          displayName: 'Following One',
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

    it('should successfully get following users with default pagination', async () => {
      mockUsersService.getFollowing.mockResolvedValue(mockResult);

      const result = await controller.getFollowing(userId, mockPaginationQuery);

      expect(result).toEqual({
        status: 'success',
        message: 'Following users retrieved successfully',
        data: mockResult.data,
        metadata: mockResult.metadata,
      });
      expect(service.getFollowing).toHaveBeenCalledWith(userId, 1, 10);
      expect(service.getFollowing).toHaveBeenCalledTimes(1);
    });

    it('should successfully get following users with custom pagination', async () => {
      const customPagination = { page: 3, limit: 20 };
      const customResult = {
        ...mockResult,
        metadata: { totalItems: 100, page: 3, limit: 20, totalPages: 5 },
      };
      mockUsersService.getFollowing.mockResolvedValue(customResult);

      const result = await controller.getFollowing(userId, customPagination);

      expect(result).toEqual({
        status: 'success',
        message: 'Following users retrieved successfully',
        data: customResult.data,
        metadata: customResult.metadata,
      });
      expect(service.getFollowing).toHaveBeenCalledWith(userId, 3, 20);
    });

    it('should return empty data when user is not following anyone', async () => {
      const emptyResult = {
        data: [],
        metadata: { totalItems: 0, page: 1, limit: 10, totalPages: 0 },
      };
      mockUsersService.getFollowing.mockResolvedValue(emptyResult);

      const result = await controller.getFollowing(userId, mockPaginationQuery);

      expect(result.data).toEqual([]);
      expect(result.metadata.totalItems).toBe(0);
    });
  });
});
