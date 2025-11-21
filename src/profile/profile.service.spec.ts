import { Test, TestingModule } from '@nestjs/testing';
import { ProfileService } from './profile.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { Services } from 'src/utils/constants';
import { NotFoundException } from '@nestjs/common';
import { UpdateProfileDto } from './dto/update-profile.dto';

describe('ProfileService', () => {
  let service: ProfileService;
  let prismaService: PrismaService;
  let storageService: StorageService;

  const mockPrismaService = {
    profile: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    follow: {
      findUnique: jest.fn(),
    },
  };

  const mockStorageService = {
    uploadFiles: jest.fn(),
    deleteFile: jest.fn(),
  };

  const mockUserSelectWithCounts = {
    id: true,
    username: true,
    email: true,
    role: true,
    created_at: true,
    _count: {
      select: {
        Followers: true,
        Following: true,
      },
    },
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
      _count: {
        Followers: 10,
        Following: 5,
      },
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        {
          provide: Services.PRISMA,
          useValue: mockPrismaService,
        },
        {
          provide: Services.STORAGE,
          useValue: mockStorageService,
        },
      ],
    }).compile();

    service = module.get<ProfileService>(ProfileService);
    prismaService = module.get<PrismaService>(Services.PRISMA);
    storageService = module.get<StorageService>(Services.STORAGE);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getProfileByUserId', () => {
    it('should return a profile when found without current user', async () => {
      mockPrismaService.profile.findUnique.mockResolvedValue(mockProfile);

      const result = await service.getProfileByUserId(1);

      expect(result).toHaveProperty('followers_count', 10);
      expect(result).toHaveProperty('following_count', 5);
      expect(result).toHaveProperty('is_followed_by_me', false);
      expect(mockPrismaService.profile.findUnique).toHaveBeenCalledWith({
        where: { user_id: 1, is_deactivated: false },
        include: {
          User: {
            select: mockUserSelectWithCounts,
          },
        },
      });
    });

    it('should return a profile with follow status when current user is provided', async () => {
      mockPrismaService.profile.findUnique.mockResolvedValue(mockProfile);
      mockPrismaService.follow.findUnique.mockResolvedValue({
        followerId: 2,
        followingId: 1,
      });

      const result = await service.getProfileByUserId(1, 2);

      expect(result).toHaveProperty('is_followed_by_me', true);
      expect(mockPrismaService.follow.findUnique).toHaveBeenCalledWith({
        where: {
          followerId_followingId: {
            followerId: 2,
            followingId: 1,
          },
        },
      });
    });

    it('should return is_followed_by_me as false when not following', async () => {
      mockPrismaService.profile.findUnique.mockResolvedValue(mockProfile);
      mockPrismaService.follow.findUnique.mockResolvedValue(null);

      const result = await service.getProfileByUserId(1, 2);

      expect(result).toHaveProperty('is_followed_by_me', false);
    });

    it('should not check follow status when viewing own profile', async () => {
      mockPrismaService.profile.findUnique.mockResolvedValue(mockProfile);

      const result = await service.getProfileByUserId(1, 1);

      expect(result).toHaveProperty('is_followed_by_me', false);
      expect(mockPrismaService.follow.findUnique).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when profile not found', async () => {
      mockPrismaService.profile.findUnique.mockResolvedValue(null);

      await expect(service.getProfileByUserId(999)).rejects.toThrow(NotFoundException);
      await expect(service.getProfileByUserId(999)).rejects.toThrow('Profile not found');
    });

    it('should filter out deactivated profiles', async () => {
      mockPrismaService.profile.findUnique.mockResolvedValue(null);

      await expect(service.getProfileByUserId(1)).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.profile.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ is_deactivated: false }),
        }),
      );
    });
  });

  describe('getProfileByUsername', () => {
    it('should return a profile when found by username', async () => {
      mockPrismaService.profile.findFirst.mockResolvedValue(mockProfile);

      const result = await service.getProfileByUsername('john_doe');

      expect(result).toHaveProperty('followers_count', 10);
      expect(result).toHaveProperty('following_count', 5);
      expect(mockPrismaService.profile.findFirst).toHaveBeenCalledWith({
        where: {
          User: {
            username: 'john_doe',
          },
          is_deactivated: false,
        },
        include: {
          User: {
            select: mockUserSelectWithCounts,
          },
        },
      });
    });

    it('should return profile with follow status for authenticated user', async () => {
      mockPrismaService.profile.findFirst.mockResolvedValue(mockProfile);
      mockPrismaService.follow.findUnique.mockResolvedValue({
        followerId: 2,
        followingId: 1,
      });

      const result = await service.getProfileByUsername('john_doe', 2);

      expect(result).toHaveProperty('is_followed_by_me', true);
    });

    it('should throw NotFoundException when username not found', async () => {
      mockPrismaService.profile.findFirst.mockResolvedValue(null);

      await expect(service.getProfileByUsername('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    it('should update and return the profile', async () => {
      const updateDto: UpdateProfileDto = {
        name: 'Jane Doe',
        bio: 'Updated bio',
      };

      const updatedProfile = {
        ...mockProfile,
        ...updateDto,
      };

      mockPrismaService.profile.findUnique.mockResolvedValue(mockProfile);
      mockPrismaService.profile.update.mockResolvedValue(updatedProfile);

      const result = await service.updateProfile(1, updateDto);

      expect(result).toHaveProperty('name', 'Jane Doe');
      expect(result).toHaveProperty('bio', 'Updated bio');
      expect(mockPrismaService.profile.update).toHaveBeenCalledWith({
        where: { user_id: 1 },
        data: updateDto,
        include: {
          User: {
            select: mockUserSelectWithCounts,
          },
        },
      });
    });

    it('should update profile with all fields', async () => {
      const updateDto: UpdateProfileDto = {
        name: 'Jane Doe',
        bio: 'New bio',
        location: 'New York',
        website: 'https://newsite.com',
        birth_date: new Date('1995-05-05'),
      };

      mockPrismaService.profile.findUnique.mockResolvedValue(mockProfile);
      mockPrismaService.profile.update.mockResolvedValue({
        ...mockProfile,
        ...updateDto,
      });

      const result = await service.updateProfile(1, updateDto);

      expect(result).toHaveProperty('location', 'New York');
      expect(result).toHaveProperty('website', 'https://newsite.com');
    });

    it('should throw NotFoundException when profile does not exist', async () => {
      mockPrismaService.profile.findUnique.mockResolvedValue(null);

      await expect(service.updateProfile(999, { name: 'Test' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('profileExists', () => {
    it('should return true when profile exists', async () => {
      mockPrismaService.profile.findUnique.mockResolvedValue(mockProfile);

      const result = await service.profileExists(1);

      expect(result).toBe(true);
      expect(mockPrismaService.profile.findUnique).toHaveBeenCalledWith({
        where: { user_id: 1 },
      });
    });

    it('should return false when profile does not exist', async () => {
      mockPrismaService.profile.findUnique.mockResolvedValue(null);

      const result = await service.profileExists(999);

      expect(result).toBe(false);
    });
  });

  describe('searchProfiles', () => {
    it('should search profiles by username', async () => {
      const profiles = [mockProfile];
      mockPrismaService.profile.count.mockResolvedValue(1);
      mockPrismaService.profile.findMany.mockResolvedValue(profiles);

      const result = await service.searchProfiles('john', 1, 10);

      expect(result.profiles).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(1);
    });

    it('should search profiles by name', async () => {
      mockPrismaService.profile.count.mockResolvedValue(1);
      mockPrismaService.profile.findMany.mockResolvedValue([mockProfile]);

      const result = await service.searchProfiles('Doe', 1, 10);

      expect(result.profiles).toHaveLength(1);
      expect(mockPrismaService.profile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              {
                User: {
                  username: {
                    contains: 'Doe',
                    mode: 'insensitive',
                  },
                },
              },
              {
                name: {
                  contains: 'Doe',
                  mode: 'insensitive',
                },
              },
            ]),
          }),
        }),
      );
    });

    it('should handle pagination correctly', async () => {
      mockPrismaService.profile.count.mockResolvedValue(25);
      mockPrismaService.profile.findMany.mockResolvedValue([mockProfile]);

      const result = await service.searchProfiles('test', 2, 10);

      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(3);
      expect(mockPrismaService.profile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      );
    });

    it('should filter out blocked/muted users when currentUserId provided', async () => {
      mockPrismaService.profile.count.mockResolvedValue(0);
      mockPrismaService.profile.findMany.mockResolvedValue([]);

      await service.searchProfiles('test', 1, 10, 5);

      expect(mockPrismaService.profile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              {
                NOT: {
                  User: {
                    Blockers: {
                      some: {
                        blockerId: 5,
                      },
                    },
                  },
                },
              },
              {
                NOT: {
                  User: {
                    Blocked: {
                      some: {
                        blockedId: 5,
                      },
                    },
                  },
                },
              },
              {
                NOT: {
                  User: {
                    Muters: {
                      some: {
                        muterId: 5,
                      },
                    },
                  },
                },
              },
            ]),
          }),
        }),
      );
    });

    it('should return empty results when no matches found', async () => {
      mockPrismaService.profile.count.mockResolvedValue(0);
      mockPrismaService.profile.findMany.mockResolvedValue([]);

      const result = await service.searchProfiles('nonexistent', 1, 10);

      expect(result.profiles).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
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

    it('should upload and update profile picture', async () => {
      const updatedProfile = {
        ...mockProfile,
        profile_image_url: 'https://example.com/new-image.jpg',
      };

      mockPrismaService.profile.findUnique.mockResolvedValue(mockProfile);
      mockStorageService.uploadFiles.mockResolvedValue(['https://example.com/new-image.jpg']);
      mockPrismaService.profile.update.mockResolvedValue(updatedProfile);

      const result = await service.updateProfilePicture(1, mockFile);

      expect(result).toHaveProperty('profile_image_url', 'https://example.com/new-image.jpg');
      expect(mockStorageService.uploadFiles).toHaveBeenCalledWith([mockFile]);
      expect(mockStorageService.deleteFile).toHaveBeenCalledWith(mockProfile.profile_image_url);
    });

    it('should delete old profile picture before uploading new one', async () => {
      mockPrismaService.profile.findUnique.mockResolvedValue(mockProfile);
      mockStorageService.uploadFiles.mockResolvedValue(['https://example.com/new-image.jpg']);
      mockPrismaService.profile.update.mockResolvedValue(mockProfile);

      await service.updateProfilePicture(1, mockFile);

      expect(mockStorageService.deleteFile).toHaveBeenCalledWith(mockProfile.profile_image_url);
      expect(mockStorageService.uploadFiles).toHaveBeenCalledWith([mockFile]);
    });

    it('should not delete when no existing profile picture', async () => {
      const profileWithoutImage = {
        ...mockProfile,
        profile_image_url: null,
      };

      mockPrismaService.profile.findUnique.mockResolvedValue(profileWithoutImage);
      mockStorageService.uploadFiles.mockResolvedValue(['https://example.com/new-image.jpg']);
      mockPrismaService.profile.update.mockResolvedValue(profileWithoutImage);

      await service.updateProfilePicture(1, mockFile);

      expect(mockStorageService.deleteFile).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when profile not found', async () => {
      mockPrismaService.profile.findUnique.mockResolvedValue(null);

      await expect(service.updateProfilePicture(999, mockFile)).rejects.toThrow(NotFoundException);
    });

    it('should continue even if old image deletion fails', async () => {
      const updatedProfile = {
        ...mockProfile,
        profile_image_url: 'https://example.com/new-image.jpg',
      };

      mockPrismaService.profile.findUnique.mockResolvedValue(mockProfile);
      mockStorageService.deleteFile.mockRejectedValue(new Error('Delete failed'));
      mockStorageService.uploadFiles.mockResolvedValue(['https://example.com/new-image.jpg']);
      mockPrismaService.profile.update.mockResolvedValue(updatedProfile);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await service.updateProfilePicture(1, mockFile);

      expect(result).toHaveProperty('profile_image_url', 'https://example.com/new-image.jpg');
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('deleteProfilePicture', () => {
    it('should delete profile picture and set to null', async () => {
      const updatedProfile = {
        ...mockProfile,
        profile_image_url: null,
      };

      mockPrismaService.profile.findUnique.mockResolvedValue(mockProfile);
      mockPrismaService.profile.update.mockResolvedValue(updatedProfile);

      const result = await service.deleteProfilePicture(1);

      expect(result).toHaveProperty('profile_image_url', null);
      expect(mockStorageService.deleteFile).toHaveBeenCalledWith(mockProfile.profile_image_url);
      expect(mockPrismaService.profile.update).toHaveBeenCalledWith({
        where: { user_id: 1 },
        data: { profile_image_url: null },
        include: {
          User: {
            select: mockUserSelectWithCounts,
          },
        },
      });
    });

    it('should not delete file when no profile picture exists', async () => {
      const profileWithoutImage = {
        ...mockProfile,
        profile_image_url: null,
      };

      mockPrismaService.profile.findUnique.mockResolvedValue(profileWithoutImage);
      mockPrismaService.profile.update.mockResolvedValue(profileWithoutImage);

      await service.deleteProfilePicture(1);

      expect(mockStorageService.deleteFile).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when profile not found', async () => {
      mockPrismaService.profile.findUnique.mockResolvedValue(null);

      await expect(service.deleteProfilePicture(999)).rejects.toThrow(NotFoundException);
    });

    it('should continue even if file deletion fails', async () => {
      const updatedProfile = {
        ...mockProfile,
        profile_image_url: null,
      };

      mockPrismaService.profile.findUnique.mockResolvedValue(mockProfile);
      mockStorageService.deleteFile.mockRejectedValue(new Error('Delete failed'));
      mockPrismaService.profile.update.mockResolvedValue(updatedProfile);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await service.deleteProfilePicture(1);

      expect(result).toHaveProperty('profile_image_url', null);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
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

    it('should upload and update banner', async () => {
      const updatedProfile = {
        ...mockProfile,
        banner_image_url: 'https://example.com/new-banner.jpg',
      };

      mockPrismaService.profile.findUnique.mockResolvedValue(mockProfile);
      mockStorageService.uploadFiles.mockResolvedValue(['https://example.com/new-banner.jpg']);
      mockPrismaService.profile.update.mockResolvedValue(updatedProfile);

      const result = await service.updateBanner(1, mockFile);

      expect(result).toHaveProperty('banner_image_url', 'https://example.com/new-banner.jpg');
      expect(mockStorageService.uploadFiles).toHaveBeenCalledWith([mockFile]);
      expect(mockStorageService.deleteFile).toHaveBeenCalledWith(mockProfile.banner_image_url);
    });

    it('should delete old banner before uploading new one', async () => {
      mockPrismaService.profile.findUnique.mockResolvedValue(mockProfile);
      mockStorageService.uploadFiles.mockResolvedValue(['https://example.com/new-banner.jpg']);
      mockPrismaService.profile.update.mockResolvedValue(mockProfile);

      await service.updateBanner(1, mockFile);

      expect(mockStorageService.deleteFile).toHaveBeenCalledWith(mockProfile.banner_image_url);
    });

    it('should not delete when no existing banner', async () => {
      const profileWithoutBanner = {
        ...mockProfile,
        banner_image_url: null,
      };

      mockPrismaService.profile.findUnique.mockResolvedValue(profileWithoutBanner);
      mockStorageService.uploadFiles.mockResolvedValue(['https://example.com/new-banner.jpg']);
      mockPrismaService.profile.update.mockResolvedValue(profileWithoutBanner);

      await service.updateBanner(1, mockFile);

      expect(mockStorageService.deleteFile).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when profile not found', async () => {
      mockPrismaService.profile.findUnique.mockResolvedValue(null);

      await expect(service.updateBanner(999, mockFile)).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteBanner', () => {
    it('should delete banner and set to null', async () => {
      const updatedProfile = {
        ...mockProfile,
        banner_image_url: null,
      };

      mockPrismaService.profile.findUnique.mockResolvedValue(mockProfile);
      mockPrismaService.profile.update.mockResolvedValue(updatedProfile);

      const result = await service.deleteBanner(1);

      expect(result).toHaveProperty('banner_image_url', null);
      expect(mockStorageService.deleteFile).toHaveBeenCalledWith(mockProfile.banner_image_url);
      expect(mockPrismaService.profile.update).toHaveBeenCalledWith({
        where: { user_id: 1 },
        data: { banner_image_url: null },
        include: {
          User: {
            select: mockUserSelectWithCounts,
          },
        },
      });
    });

    it('should not delete file when no banner exists', async () => {
      const profileWithoutBanner = {
        ...mockProfile,
        banner_image_url: null,
      };

      mockPrismaService.profile.findUnique.mockResolvedValue(profileWithoutBanner);
      mockPrismaService.profile.update.mockResolvedValue(profileWithoutBanner);

      await service.deleteBanner(1);

      expect(mockStorageService.deleteFile).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when profile not found', async () => {
      mockPrismaService.profile.findUnique.mockResolvedValue(null);

      await expect(service.deleteBanner(999)).rejects.toThrow(NotFoundException);
    });

    it('should continue even if file deletion fails', async () => {
      const updatedProfile = {
        ...mockProfile,
        banner_image_url: null,
      };

      mockPrismaService.profile.findUnique.mockResolvedValue(mockProfile);
      mockStorageService.deleteFile.mockRejectedValue(new Error('Delete failed'));
      mockPrismaService.profile.update.mockResolvedValue(updatedProfile);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await service.deleteBanner(1);

      expect(result).toHaveProperty('banner_image_url', null);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
