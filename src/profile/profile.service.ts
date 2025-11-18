import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { Services } from 'src/utils/constants';

@Injectable()
export class ProfileService {
  constructor(
    @Inject(Services.PRISMA)
    private readonly prismaService: PrismaService,
    @Inject(Services.STORAGE)
    private readonly storageService: StorageService,
  ) {}

  public async getProfileByUserId(userId: number) {
    const profile = await this.prismaService.profile.findUnique({
      where: {
        user_id: userId,
        is_deactivated: false,
      },
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

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    return profile;
  }

  public async getProfileByUsername(username: string) {
    const profile = await this.prismaService.profile.findFirst({
      where: {
        User: {
          username,
        },
        is_deactivated: false,
      },
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

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    return profile;
  }

  public async updateProfile(userId: number, updateProfileDto: UpdateProfileDto) {
    const existingProfile = await this.prismaService.profile.findUnique({
      where: {
        user_id: userId,
      },
    });

    if (!existingProfile) {
      throw new NotFoundException('Profile not found');
    }

    const updatedProfile = await this.prismaService.profile.update({
      where: {
        user_id: userId,
      },
      data: updateProfileDto,
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

    return updatedProfile;
  }

  public async profileExists(userId: number): Promise<boolean> {
    const profile = await this.prismaService.profile.findUnique({
      where: {
        user_id: userId,
      },
    });

    return !!profile;
  }

  public async searchProfiles(query: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const total = await this.prismaService.profile.count({
      where: {
        is_deactivated: false,
        OR: [
          {
            User: {
              username: {
                contains: query,
                mode: 'insensitive',
              },
            },
          },
          {
            name: {
              contains: query,
              mode: 'insensitive',
            },
          },
        ],
      },
    });

    const profiles = await this.prismaService.profile.findMany({
      where: {
        is_deactivated: false,
        OR: [
          {
            User: {
              username: {
                contains: query,
                mode: 'insensitive',
              },
            },
          },
          {
            name: {
              contains: query,
              mode: 'insensitive',
            },
          },
        ],
      },
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
      skip,
      take: limit,
      orderBy: [
        {
          User: {
            username: 'asc',
          },
        },
        {
          name: 'asc',
        },
      ],
    });

    const totalPages = Math.ceil(total / limit);

    return {
      profiles,
      total,
      page,
      limit,
      totalPages,
    };
  }

  public async updateProfilePicture(userId: number, file: Express.Multer.File) {
    const profile = await this.prismaService.profile.findUnique({
      where: { user_id: userId },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    if (profile.profile_image_url) {
      try {
        await this.storageService.deleteFile(profile.profile_image_url);
      } catch (error) {
        console.error('Failed to delete old profile picture:', error);
      }
    }

    const [imageUrl] = await this.storageService.uploadFiles([file]);

    return await this.prismaService.profile.update({
      where: { user_id: userId },
      data: { profile_image_url: imageUrl },
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
  }

  public async deleteProfilePicture(userId: number) {
    const profile = await this.prismaService.profile.findUnique({
      where: { user_id: userId },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    if (profile.profile_image_url) {
      try {
        await this.storageService.deleteFile(profile.profile_image_url);
      } catch (error) {
        console.error('Failed to delete profile picture:', error);
      }
    }

    return await this.prismaService.profile.update({
      where: { user_id: userId },
      data: { profile_image_url: null },
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
  }

  public async updateBanner(userId: number, file: Express.Multer.File) {
    const profile = await this.prismaService.profile.findUnique({
      where: { user_id: userId },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    if (profile.banner_image_url) {
      try {
        await this.storageService.deleteFile(profile.banner_image_url);
      } catch (error) {
        console.error('Failed to delete old banner:', error);
      }
    }

    const [bannerUrl] = await this.storageService.uploadFiles([file]);

    return await this.prismaService.profile.update({
      where: { user_id: userId },
      data: { banner_image_url: bannerUrl },
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
  }

  public async deleteBanner(userId: number) {
    const profile = await this.prismaService.profile.findUnique({
      where: { user_id: userId },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    if (profile.banner_image_url) {
      try {
        await this.storageService.deleteFile(profile.banner_image_url);
      } catch (error) {
        console.error('Failed to delete banner:', error);
      }
    }

    return await this.prismaService.profile.update({
      where: { user_id: userId },
      data: { banner_image_url: null },
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
  }
}
