import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { Services } from 'src/utils/constants';

@Injectable()
export class ProfileService {
  constructor(
    @Inject(Services.PRISMA)
    private readonly prismaService: PrismaService,
  ) {}

  public async getProfileByUserId(userId: number) {
    const profile = await this.prismaService.profile.findUnique({
      where: {
        user_id: userId,
        is_deactivated: false
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

  public async updateProfile(
    userId: number,
    updateProfileDto: UpdateProfileDto,
  ) {
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
}
