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

  private readonly userSelectWithCounts = {
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

  private formatProfileResponse(profile: any) {
    const { User, ...profileData } = profile;
    const { _count, ...userData } = User;

    return {
      ...profileData,
      User: userData,
      followers_count: _count.Followers,
      following_count: _count.Following,
    };
  }

  private formatProfileResponseWithFollowStatus(
    profile: any,
    isFollowedByMe: boolean,
    isBeenBlocked: boolean = false,
    isBlockedByMe: boolean = false,
    isMutedByMe: boolean = false,
  ) {
    const { User, ...profileData } = profile;
    const { _count, ...userData } = User;

    return {
      ...profileData,
      User: userData,
      followers_count: _count.Followers,
      following_count: _count.Following,
      is_followed_by_me: isFollowedByMe,
      is_been_blocked: isBeenBlocked,
      is_blocked_by_me: isBlockedByMe,
      is_muted_by_me: isMutedByMe,
    };
  }

  public async getProfileByUserId(userId: number, currentUserId?: number) {
    const profile = await this.prismaService.profile.findUnique({
      where: {
        user_id: userId,
        is_deactivated: false,
      },
      include: {
        User: {
          select: this.userSelectWithCounts,
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    let isFollowedByMe = false;
    let isBeenBlocked = false;
    let isBlockedByMe = false;
    let isMutedByMe = false;

    if (currentUserId && currentUserId !== userId) {
      // Check if current user follows the profile user
      const followRelation = await this.prismaService.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: currentUserId,
            followingId: userId,
          },
        },
      });
      isFollowedByMe = !!followRelation;

      // Check if the profile user has blocked the current user
      const blockByProfile = await this.prismaService.block.findUnique({
        where: {
          blockerId_blockedId: {
            blockerId: userId,
            blockedId: currentUserId,
          },
        },
      });
      isBeenBlocked = !!blockByProfile;

      // Check if current user has blocked the profile user
      const blockByCurrentUser = await this.prismaService.block.findUnique({
        where: {
          blockerId_blockedId: {
            blockerId: currentUserId,
            blockedId: userId,
          },
        },
      });
      isBlockedByMe = !!blockByCurrentUser;

      // Check if current user has muted the profile user
      const muteByCurrentUser = await this.prismaService.mute.findUnique({
        where: {
          muterId_mutedId: {
            muterId: currentUserId,
            mutedId: userId,
          },
        },
      });
      isMutedByMe = !!muteByCurrentUser;
    }

    return this.formatProfileResponseWithFollowStatus(
      profile,
      isFollowedByMe,
      isBeenBlocked,
      isBlockedByMe,
      isMutedByMe,
    );
  }

  public async getProfileByUsername(username: string, currentUserId?: number) {
    const profile = await this.prismaService.profile.findFirst({
      where: {
        User: {
          username,
        },
        is_deactivated: false,
      },
      include: {
        User: {
          select: this.userSelectWithCounts,
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    let isFollowedByMe = false;
    let isBeenBlocked = false;
    let isBlockedByMe = false;
    let isMutedByMe = false;

    if (currentUserId && currentUserId !== profile.user_id) {
      // Check if current user follows the profile user
      const followRelation = await this.prismaService.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: currentUserId,
            followingId: profile.user_id,
          },
        },
      });
      isFollowedByMe = !!followRelation;

      // Check if the profile user has blocked the current user
      const blockByProfile = await this.prismaService.block.findUnique({
        where: {
          blockerId_blockedId: {
            blockerId: profile.user_id,
            blockedId: currentUserId,
          },
        },
      });
      isBeenBlocked = !!blockByProfile;

      // Check if current user has blocked the profile user
      const blockByCurrentUser = await this.prismaService.block.findUnique({
        where: {
          blockerId_blockedId: {
            blockerId: currentUserId,
            blockedId: profile.user_id,
          },
        },
      });
      isBlockedByMe = !!blockByCurrentUser;

      // Check if current user has muted the profile user
      const muteByCurrentUser = await this.prismaService.mute.findUnique({
        where: {
          muterId_mutedId: {
            muterId: currentUserId,
            mutedId: profile.user_id,
          },
        },
      });
      isMutedByMe = !!muteByCurrentUser;
    }

    return this.formatProfileResponseWithFollowStatus(
      profile,
      isFollowedByMe,
      isBeenBlocked,
      isBlockedByMe,
      isMutedByMe,
    );
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
          select: this.userSelectWithCounts,
        },
      },
    });

    return this.formatProfileResponse(updatedProfile);
  }

  public async profileExists(userId: number): Promise<boolean> {
    const profile = await this.prismaService.profile.findUnique({
      where: {
        user_id: userId,
      },
    });

    return !!profile;
  }

  public async searchProfiles(
    query: string,
    page: number = 1,
    limit: number = 10,
    currentUserId?: number,
  ) {
    const skip = (page - 1) * limit;

    const blockMuteFilter = currentUserId
      ? {
          AND: [
            {
              NOT: {
                User: {
                  Blockers: {
                    some: {
                      blockerId: currentUserId,
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
                      blockedId: currentUserId,
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
                      muterId: currentUserId,
                    },
                  },
                },
              },
            },
          ],
        }
      : {};

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
        ...blockMuteFilter,
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
        ...blockMuteFilter,
      },
      include: {
        User: {
          select: this.userSelectWithCounts,
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

    const profilesWithCounts = profiles.map((profile) => this.formatProfileResponse(profile));

    return {
      profiles: profilesWithCounts,
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

    const updatedProfile = await this.prismaService.profile.update({
      where: { user_id: userId },
      data: { profile_image_url: imageUrl },
      include: {
        User: {
          select: this.userSelectWithCounts,
        },
      },
    });

    return this.formatProfileResponse(updatedProfile);
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

    const updatedProfile = await this.prismaService.profile.update({
      where: { user_id: userId },
      data: { profile_image_url: null },
      include: {
        User: {
          select: this.userSelectWithCounts,
        },
      },
    });

    return this.formatProfileResponse(updatedProfile);
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

    const updatedProfile = await this.prismaService.profile.update({
      where: { user_id: userId },
      data: { banner_image_url: bannerUrl },
      include: {
        User: {
          select: this.userSelectWithCounts,
        },
      },
    });

    return this.formatProfileResponse(updatedProfile);
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

    const updatedProfile = await this.prismaService.profile.update({
      where: { user_id: userId },
      data: { banner_image_url: null },
      include: {
        User: {
          select: this.userSelectWithCounts,
        },
      },
    });

    return this.formatProfileResponse(updatedProfile);
  }
}
