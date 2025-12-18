import { Test, TestingModule } from '@nestjs/testing';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { Services } from 'src/utils/constants';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

describe('ProfileController', () => {
  let controller: ProfileController;
  let service: ProfileService;

  const mockProfileService = {
    getProfileByUserId: jest.fn(),
    getProfileByUsername: jest.fn(),
    searchProfiles: jest.fn(),
    updateProfile: jest.fn(),
    updateProfilePicture: jest.fn(),
    deleteProfilePicture: jest.fn(),
    updateBanner: jest.fn(),
    deleteBanner: jest.fn(),
  };

  const mockProfile = {
    id: 1,
    user_id: 1,
    name: 'John Doe',
    birth_date: new Date('1990-01-01'),
    bio: 'Test bio',
    location: 'San Francisco',
    website: 'https://example.com',
    profile_image_url: 'https://example.com/image.jpg',
    banner_image_url: 'https://example.com/banner.jpg',
    is_deactivated: false,
    created_at: new Date(),
    updated_at: new Date(),
    User: {
      id: 1,
      username: 'john_doe',
      email: 'john@example.com',
      role: 'USER',
      created_at: new Date(),
    },
    followers_count: 10,
    following_count: 5,
  };

  const mockUser = { id: 1, username: 'john_doe' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfileController],
      providers: [
        {
          provide: Services.PROFILE,
          useValue: mockProfileService,
        },
      ],
    }).compile();

    controller = module.get<ProfileController>(ProfileController);
    service = module.get<ProfileService>(Services.PROFILE);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMyProfile', () => {
    it('should return the current user profile', async () => {
      mockProfileService.getProfileByUserId.mockResolvedValue(mockProfile);

      const result = await controller.getMyProfile(mockUser);

      expect(result.status).toBe('success');
      expect(result.message).toBe('Profile retrieved successfully');
      expect(result.data).toEqual(mockProfile);
      expect(mockProfileService.getProfileByUserId).toHaveBeenCalledWith(1);
    });

    it('should pass user id from CurrentUser decorator', async () => {
      mockProfileService.getProfileByUserId.mockResolvedValue(mockProfile);

      await controller.getMyProfile(mockUser);

      expect(mockProfileService.getProfileByUserId).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('getProfileByUserId', () => {
    it('should return a profile by user ID without current user', async () => {
      mockProfileService.getProfileByUserId.mockResolvedValue(mockProfile);

      const result = await controller.getProfileByUserId(1);

      expect(result.status).toBe('success');
      expect(result.message).toBe('Profile retrieved successfully');
      expect(result.data).toEqual(mockProfile);
      expect(mockProfileService.getProfileByUserId).toHaveBeenCalledWith(1, undefined);
    });

    it('should return a profile by user ID with current user', async () => {
      const profileWithFollowStatus = {
        ...mockProfile,
        is_followed_by_me: true,
      };
      mockProfileService.getProfileByUserId.mockResolvedValue(profileWithFollowStatus);

      const result = await controller.getProfileByUserId(2, mockUser);

      expect(result.status).toBe('success');
      expect(result.data).toEqual(profileWithFollowStatus);
      expect(mockProfileService.getProfileByUserId).toHaveBeenCalledWith(2, mockUser.id);
    });
  });

  describe('getProfileByUsername', () => {
    it('should return a profile by username without current user', async () => {
      mockProfileService.getProfileByUsername.mockResolvedValue(mockProfile);

      const result = await controller.getProfileByUsername('john_doe');

      expect(result.status).toBe('success');
      expect(result.message).toBe('Profile retrieved successfully');
      expect(result.data).toEqual(mockProfile);
      expect(mockProfileService.getProfileByUsername).toHaveBeenCalledWith('john_doe', undefined);
    });

    it('should return a profile by username with current user', async () => {
      const profileWithFollowStatus = {
        ...mockProfile,
        is_followed_by_me: false,
      };
      mockProfileService.getProfileByUsername.mockResolvedValue(profileWithFollowStatus);

      const result = await controller.getProfileByUsername('jane_doe', mockUser);

      expect(result.status).toBe('success');
      expect(result.data).toEqual(profileWithFollowStatus);
      expect(mockProfileService.getProfileByUsername).toHaveBeenCalledWith('jane_doe', mockUser.id);
    });
  });

  describe('searchProfiles', () => {
    const paginationDto: PaginationDto = { page: 1, limit: 10 };

    it('should return empty array when no query provided', async () => {
      const result = await controller.searchProfiles('', paginationDto);

      expect(result.status).toBe('success');
      expect(result.message).toBe('No search query provided');
      expect(result.data).toEqual([]);
      expect(result.metadata).toEqual({
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      });
      expect(mockProfileService.searchProfiles).not.toHaveBeenCalled();
    });

    it('should return empty array when query is only whitespace', async () => {
      const result = await controller.searchProfiles('   ', paginationDto);

      expect(result.status).toBe('success');
      expect(result.message).toBe('No search query provided');
      expect(result.data).toEqual([]);
      expect(mockProfileService.searchProfiles).not.toHaveBeenCalled();
    });

    it('should search profiles successfully with results', async () => {
      const searchResults = {
        profiles: [mockProfile],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      };
      mockProfileService.searchProfiles.mockResolvedValue(searchResults);

      const result = await controller.searchProfiles('john', paginationDto);

      expect(result.status).toBe('success');
      expect(result.message).toBe('Profiles found successfully');
      expect(result.data).toEqual([mockProfile]);
      expect(result.metadata).toEqual({
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
      expect(mockProfileService.searchProfiles).toHaveBeenCalledWith('john', 1, 10, undefined);
    });

    it('should search profiles with no results', async () => {
      const searchResults = {
        profiles: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      };
      mockProfileService.searchProfiles.mockResolvedValue(searchResults);

      const result = await controller.searchProfiles('nonexistent', paginationDto);

      expect(result.status).toBe('success');
      expect(result.message).toBe('No profiles found');
      expect(result.data).toEqual([]);
    });

    it('should trim search query before searching', async () => {
      const searchResults = {
        profiles: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      };
      mockProfileService.searchProfiles.mockResolvedValue(searchResults);

      await controller.searchProfiles('  john  ', paginationDto);

      expect(mockProfileService.searchProfiles).toHaveBeenCalledWith('john', 1, 10, undefined);
    });

    it('should search profiles with authenticated user', async () => {
      const searchResults = {
        profiles: [mockProfile],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      };
      mockProfileService.searchProfiles.mockResolvedValue(searchResults);

      await controller.searchProfiles('john', paginationDto, mockUser);

      expect(mockProfileService.searchProfiles).toHaveBeenCalledWith('john', 1, 10, mockUser.id);
    });

    it('should handle custom pagination', async () => {
      const customPagination = { page: 2, limit: 20 };
      const searchResults = {
        profiles: [],
        total: 0,
        page: 2,
        limit: 20,
        totalPages: 0,
      };
      mockProfileService.searchProfiles.mockResolvedValue(searchResults);

      await controller.searchProfiles('test', customPagination);

      expect(mockProfileService.searchProfiles).toHaveBeenCalledWith('test', 2, 20, undefined);
    });
  });

  describe('updateMyProfile', () => {
    it('should update the current user profile', async () => {
      const updateDto: UpdateProfileDto = {
        name: 'Jane Doe',
        bio: 'Updated bio',
      };

      const updatedProfile = {
        ...mockProfile,
        ...updateDto,
      };

      mockProfileService.updateProfile.mockResolvedValue(updatedProfile);

      const result = await controller.updateMyProfile(mockUser, updateDto);

      expect(result.status).toBe('success');
      expect(result.message).toBe('Profile updated successfully');
      expect(result.data).toEqual(updatedProfile);
      expect(mockProfileService.updateProfile).toHaveBeenCalledWith(1, updateDto);
    });

    it('should update profile with all fields', async () => {
      const updateDto: UpdateProfileDto = {
        name: 'Jane Doe',
        bio: 'New bio',
        location: 'New York',
        website: 'https://newsite.com',
        birth_date: new Date('1995-05-05'),
      };

      const updatedProfile = {
        ...mockProfile,
        ...updateDto,
      };

      mockProfileService.updateProfile.mockResolvedValue(updatedProfile);

      const result = await controller.updateMyProfile(mockUser, updateDto);

      expect(result.data).toEqual(updatedProfile);
      expect(mockProfileService.updateProfile).toHaveBeenCalledWith(mockUser.id, updateDto);
    });
  });

  describe('updateProfilePicture', () => {
    const mockFile = {
      fieldname: 'file',
      originalname: 'profile.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      size: 1024,
      buffer: Buffer.from('test'),
    } as Express.Multer.File;

    it('should update profile picture successfully', async () => {
      const updatedProfile = {
        ...mockProfile,
        profile_image_url: 'https://example.com/new-image.jpg',
      };

      mockProfileService.updateProfilePicture.mockResolvedValue(updatedProfile);

      const result = await controller.updateProfilePicture(mockUser, mockFile);

      expect(result.status).toBe('success');
      expect(result.message).toBe('Profile picture updated successfully');
      expect(result.data).toEqual(updatedProfile);
      expect(mockProfileService.updateProfilePicture).toHaveBeenCalledWith(mockUser.id, mockFile);
    });

    it('should handle profile picture update for user without existing image', async () => {
      const profileWithoutImage = {
        ...mockProfile,
        profile_image_url: null,
      };

      const updatedProfile = {
        ...profileWithoutImage,
        profile_image_url: 'https://example.com/first-image.jpg',
      };

      mockProfileService.updateProfilePicture.mockResolvedValue(updatedProfile);

      const result = await controller.updateProfilePicture(mockUser, mockFile);

      expect(result.status).toBe('success');
      expect(result.data.profile_image_url).toBe('https://example.com/first-image.jpg');
    });
  });

  describe('deleteProfilePicture', () => {
    it('should delete profile picture successfully', async () => {
      const updatedProfile = {
        ...mockProfile,
        profile_image_url: null,
      };

      mockProfileService.deleteProfilePicture.mockResolvedValue(updatedProfile);

      const result = await controller.deleteProfilePicture(mockUser);

      expect(result.status).toBe('success');
      expect(result.message).toBe('Profile picture deleted successfully');
      expect(result.data).toEqual(updatedProfile);
      expect(mockProfileService.deleteProfilePicture).toHaveBeenCalledWith(mockUser.id);
    });

    it('should handle deletion when no profile picture exists', async () => {
      const profileWithoutImage = {
        ...mockProfile,
        profile_image_url: null,
      };

      mockProfileService.deleteProfilePicture.mockResolvedValue(profileWithoutImage);

      const result = await controller.deleteProfilePicture(mockUser);

      expect(result.status).toBe('success');
      expect(result.data.profile_image_url).toBeNull();
    });
  });

  describe('updateBanner', () => {
    const mockFile = {
      fieldname: 'file',
      originalname: 'banner.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      size: 2048,
      buffer: Buffer.from('test banner'),
    } as Express.Multer.File;

    it('should update banner successfully', async () => {
      const updatedProfile = {
        ...mockProfile,
        banner_image_url: 'https://example.com/new-banner.jpg',
      };

      mockProfileService.updateBanner.mockResolvedValue(updatedProfile);

      const result = await controller.updateBanner(mockUser, mockFile);

      expect(result.status).toBe('success');
      expect(result.message).toBe('Banner image updated successfully');
      expect(result.data).toEqual(updatedProfile);
      expect(mockProfileService.updateBanner).toHaveBeenCalledWith(mockUser.id, mockFile);
    });

    it('should handle banner update for user without existing banner', async () => {
      const profileWithoutBanner = {
        ...mockProfile,
        banner_image_url: null,
      };

      const updatedProfile = {
        ...profileWithoutBanner,
        banner_image_url: 'https://example.com/first-banner.jpg',
      };

      mockProfileService.updateBanner.mockResolvedValue(updatedProfile);

      const result = await controller.updateBanner(mockUser, mockFile);

      expect(result.status).toBe('success');
      expect(result.data.banner_image_url).toBe('https://example.com/first-banner.jpg');
    });
  });

  describe('deleteBanner', () => {
    it('should delete banner successfully', async () => {
      const updatedProfile = {
        ...mockProfile,
        banner_image_url: null,
      };

      mockProfileService.deleteBanner.mockResolvedValue(updatedProfile);

      const result = await controller.deleteBanner(mockUser);

      expect(result.status).toBe('success');
      expect(result.message).toBe('Banner image deleted successfully');
      expect(result.data).toEqual(updatedProfile);
      expect(mockProfileService.deleteBanner).toHaveBeenCalledWith(mockUser.id);
    });

    it('should handle deletion when no banner exists', async () => {
      const profileWithoutBanner = {
        ...mockProfile,
        banner_image_url: null,
      };

      mockProfileService.deleteBanner.mockResolvedValue(profileWithoutBanner);

      const result = await controller.deleteBanner(mockUser);

      expect(result.status).toBe('success');
      expect(result.data.banner_image_url).toBeNull();
    });
  });
});
