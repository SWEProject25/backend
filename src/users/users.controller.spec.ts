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
});
