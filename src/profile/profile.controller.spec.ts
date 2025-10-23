import { Test, TestingModule } from '@nestjs/testing';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { Services } from 'src/utils/constants';

describe('ProfileController', () => {
  let controller: ProfileController;
  let service: ProfileService;

  const mockProfileService = {
    getProfileByUserId: jest.fn(),
    getProfileByUsername: jest.fn(),
    updateProfile: jest.fn(),
  };

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
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMyProfile', () => {
    it('should return the current user profile', async () => {
      const mockProfile = {
        id: 1,
        user_id: 1,
        name: 'John Doe',
        birth_date: new Date('1990-01-01'),
      };

      const mockUser = { sub: 1, username: 'john_doe' };

      mockProfileService.getProfileByUserId.mockResolvedValue(mockProfile);

      const result = await controller.getMyProfile(mockUser);

      expect(result.status).toBe('success');
      expect(result.data).toEqual(mockProfile);
      expect(mockProfileService.getProfileByUserId).toHaveBeenCalledWith(1);
    });
  });

  describe('getProfileByUserId', () => {
    it('should return a profile by user ID', async () => {
      const mockProfile = {
        id: 1,
        user_id: 1,
        name: 'John Doe',
      };

      mockProfileService.getProfileByUserId.mockResolvedValue(mockProfile);

      const result = await controller.getProfileByUserId(1);

      expect(result.status).toBe('success');
      expect(result.data).toEqual(mockProfile);
    });
  });

  describe('updateMyProfile', () => {
    it('should update the current user profile', async () => {
      const updateDto = {
        name: 'Jane Doe',
        bio: 'Updated bio',
      };

      const mockUser = { sub: 1, username: 'john_doe' };

      const updatedProfile = {
        id: 1,
        user_id: 1,
        ...updateDto,
      };

      mockProfileService.updateProfile.mockResolvedValue(updatedProfile);

      const result = await controller.updateMyProfile(mockUser, updateDto);

      expect(result.status).toBe('success');
      expect(result.data).toEqual(updatedProfile);
      expect(mockProfileService.updateProfile).toHaveBeenCalledWith(
        1,
        updateDto,
      );
    });
  });
});
