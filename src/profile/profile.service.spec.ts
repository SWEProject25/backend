import { Test, TestingModule } from '@nestjs/testing';
import { ProfileService } from './profile.service';
import { PrismaService } from '../prisma/prisma.service';
import { Services } from 'src/utils/constants';
import { NotFoundException } from '@nestjs/common';

describe('ProfileService', () => {
  let service: ProfileService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    profile: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: Services.PROFILE,
          useClass: ProfileService,
        },
        {
          provide: Services.PRISMA,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ProfileService>(Services.PROFILE);
    prismaService = module.get<PrismaService>(Services.PRISMA);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getProfileByUserId', () => {
    it('should return a profile when found', async () => {
      const mockProfile = {
        id: 1,
        user_id: 1,
        name: 'John Doe',
        birth_date: new Date('1990-01-01'),
        User: {
          id: 1,
          username: 'john_doe',
          email: 'john@example.com',
          role: 'USER',
          created_at: new Date(),
        },
      };

      mockPrismaService.profile.findUnique.mockResolvedValue(mockProfile);

      const result = await service.getProfileByUserId(1);
      expect(result).toEqual(mockProfile);
      expect(mockPrismaService.profile.findUnique).toHaveBeenCalledWith({
        where: { user_id: 1 },
        include: {
          User: {
            select: {
              id: true,
              username: true,
              email: true,
              role: true,
              created_at: true,
            },
          },
        },
      });
    });

    it('should throw NotFoundException when profile not found', async () => {
      mockPrismaService.profile.findUnique.mockResolvedValue(null);

      await expect(service.getProfileByUserId(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateProfile', () => {
    it('should update and return the profile', async () => {
      const updateDto = {
        name: 'Jane Doe',
        bio: 'Updated bio',
      };

      const existingProfile = {
        id: 1,
        user_id: 1,
        name: 'John Doe',
      };

      const updatedProfile = {
        ...existingProfile,
        ...updateDto,
      };

      mockPrismaService.profile.findUnique.mockResolvedValue(existingProfile);
      mockPrismaService.profile.update.mockResolvedValue(updatedProfile);

      const result = await service.updateProfile(1, updateDto);
      expect(result).toEqual(updatedProfile);
    });

    it('should throw NotFoundException when profile does not exist', async () => {
      mockPrismaService.profile.findUnique.mockResolvedValue(null);

      await expect(
        service.updateProfile(999, { name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
