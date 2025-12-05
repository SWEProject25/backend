import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Services } from 'src/utils/constants';
import { SuggestedUserDto } from './dto/suggested-users.dto';
import { INTEREST_SLUG_TO_ENUM, UserInterest } from './enums/user-interest.enum';
import { InterestDto, UserInterestDto } from './dto/interest.dto';
import { RedisService } from 'src/redis/redis.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationType } from 'src/notifications/enums/notification.enum';

@Injectable()
export class UsersService {
  private readonly INTERESTS_CACHE_KEY = 'interests:all';
  private readonly CACHE_TTL = 3600; // 1 hour

  constructor(
    @Inject(Services.PRISMA)
    private readonly prismaService: PrismaService,
    @Inject(Services.REDIS)
    private readonly redisService: RedisService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async followUser(followerId: number, followingId: number) {
    if (followerId === followingId) {
      throw new ConflictException('You cannot follow yourself');
    }

    // Check user existence and follow status in parallel
    const [userToFollow, existingFollow, existingBlock, existingBlockRev] = await Promise.all([
      this.prismaService.user.findUnique({
        where: { id: followingId },
        select: { id: true },
      }),
      this.prismaService.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId,
            followingId,
          },
        },
      }),
      this.prismaService.block.findUnique({
        where: {
          blockerId_blockedId: {
            blockerId: followerId,
            blockedId: followingId,
          },
        },
      }),
      this.prismaService.block.findUnique({
        where: {
          blockerId_blockedId: {
            blockerId: followingId,
            blockedId: followerId,
          },
        },
      }),
    ]);

    if (!userToFollow) {
      throw new NotFoundException('User not found');
    }

    if (existingFollow) {
      throw new ConflictException('You are already following this user');
    }

    if (existingBlock) {
      throw new ConflictException('You cannot follow a user you have blocked');
    }

    if (existingBlockRev) {
      throw new ConflictException('You cannot follow a user who has blocked you');
    }

    const follow = await this.prismaService.follow.create({
      data: {
        followerId,
        followingId,
      },
    });
    await this.updateUserFollowingOnboarding(followerId);

    // Emit notification event
    this.eventEmitter.emit('notification.create', {
      type: NotificationType.FOLLOW,
      recipientId: followingId,
      actorId: followerId,
    });

    return follow;
  }

  async unfollowUser(followerId: number, followingId: number) {
    if (followerId === followingId) {
      throw new ConflictException('You cannot unfollow yourself');
    }

    const existingFollow = await this.prismaService.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });

    if (!existingFollow) {
      throw new ConflictException('You are not following this user');
    }

    const unfollow = await this.prismaService.follow.delete({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });
    await this.updateUserFollowingOnboarding(followerId);
    return unfollow;
  }

  public async updateUserFollowingOnboarding(userId: number): Promise<void> {
    const userFollowingCount = await this.getFollowingCount(userId);
    const user = await this.prismaService.user.findFirst({
      where: { id: userId },
      select: { has_completed_following: true },
    });
    if (userFollowingCount > 0 && user?.has_completed_following === false) {
      await this.prismaService.user.update({
        where: { id: userId },
        data: { has_completed_following: true },
      });
    } else if (userFollowingCount === 0 && user?.has_completed_following === true) {
      await this.prismaService.user.update({
        where: { id: userId },
        data: { has_completed_following: false },
      });
    }
  }

  async getFollowers(
    userId: number,
    page: number = 1,
    limit: number = 10,
    authenticatedUserId: number,
  ) {
    const [totalItems, followers] = await this.prismaService.$transaction([
      this.prismaService.follow.count({
        where: { followingId: userId },
      }),
      this.prismaService.follow.findMany({
        where: { followingId: userId },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          Follower: {
            select: {
              id: true,
              username: true,
              Profile: { select: { name: true, bio: true, profile_image_url: true } },
            },
          },
        },
      }),
    ]);

    // Get all follower IDs
    const followerIds = followers.map((f) => f.Follower.id);

    // Single query to check which ones the authenticated user is following
    const followingRelations = await this.prismaService.follow.findMany({
      where: {
        followerId: authenticatedUserId,
        followingId: { in: followerIds },
      },
      select: { followingId: true },
    });

    // Create a Set for O(1) lookup
    const followingSet = new Set(followingRelations.map((f) => f.followingId));

    const data = followers.map((follow) => ({
      id: follow.Follower.id,
      username: follow.Follower.username,
      displayName: follow.Follower.Profile?.name || null,
      bio: follow.Follower.Profile?.bio || null,
      profileImageUrl: follow.Follower.Profile?.profile_image_url || null,
      followedAt: follow.createdAt,
      is_followed_by_me: followingSet.has(follow.Follower.id),
    }));

    const metadata = {
      totalItems,
      page,
      limit,
      totalPages: Math.ceil(totalItems / limit),
    };

    return { data, metadata };
  }

  async getFollowing(
    userId: number,
    page: number = 1,
    limit: number = 10,
    authenticatedUserId: number,
  ) {
    const [totalItems, following] = await this.prismaService.$transaction([
      this.prismaService.follow.count({
        where: { followerId: userId },
      }),
      this.prismaService.follow.findMany({
        where: { followerId: userId },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          Following: {
            select: {
              id: true,
              username: true,
              Profile: { select: { name: true, bio: true, profile_image_url: true } },
            },
          },
        },
      }),
    ]);

    // Get all following IDs
    const followingIds = following.map((f) => f.Following.id);

    // Single query to check which ones the authenticated user is following
    const followingRelations = await this.prismaService.follow.findMany({
      where: {
        followerId: authenticatedUserId,
        followingId: { in: followingIds },
      },
      select: { followingId: true },
    });

    // Create a Set for O(1) lookup
    const followingSet = new Set(followingRelations.map((f) => f.followingId));

    const data = following.map((follow) => ({
      id: follow.Following.id,
      username: follow.Following.username,
      displayName: follow.Following.Profile?.name || null,
      bio: follow.Following.Profile?.bio || null,
      profileImageUrl: follow.Following.Profile?.profile_image_url || null,
      followedAt: follow.createdAt,
      is_followed_by_me: followingSet.has(follow.Following.id),
    }));

    const metadata = {
      totalItems,
      page,
      limit,
      totalPages: Math.ceil(totalItems / limit),
    };

    return { data, metadata };
  }

  async getFollowersYouKnow(
    userId: number,
    page: number = 1,
    limit: number = 10,
    authenticatedUserId: number,
  ) {
    // Get followers of userId who are also followed by authenticatedUserId,
    // and check if they follow authenticatedUserId back
    const followersYouKnow = await this.prismaService.$queryRawUnsafe(
      `
      SELECT 
        u.id, 
        u.username, 
        p.name AS "displayName", 
        p.bio, 
        p.profile_image_url AS "profileImageUrl", 
        f."createdAt" AS "followedAt",
        CASE WHEN f_back."followerId" IS NOT NULL THEN true ELSE false END AS "isFollowingMe"
      FROM "follows" f
      JOIN "User" u ON f."followerId" = u.id
      LEFT JOIN "profiles" p ON u.id = p.user_id
      JOIN "follows" f_me ON f_me."followerId" = $2 AND f_me."followingId" = u.id
      LEFT JOIN "follows" f_back ON f_back."followerId" = u.id AND f_back."followingId" = $2
      WHERE f."followingId" = $1
      ORDER BY f."createdAt" DESC
      OFFSET $3 LIMIT $4
    `,
      userId,
      authenticatedUserId,
      (page - 1) * limit,
      limit,
    );

    const totalItemsResult = (await this.prismaService.$queryRawUnsafe(
      `
      SELECT COUNT(*) AS count
      FROM "follows" f
      JOIN "User" u ON f."followerId" = u.id
      JOIN "follows" f_me ON f_me."followerId" = $2 AND f_me."followingId" = u.id
      WHERE f."followingId" = $1
    `,
      userId,
      authenticatedUserId,
    )) as any[];
    const totalItems = parseInt((totalItemsResult[0] as any).count, 10);

    const metadata = {
      totalItems,
      page,
      limit,
      totalPages: Math.ceil(totalItems / limit),
    };

    return { data: followersYouKnow, metadata };
  }

  async blockUser(blockerId: number, blockedId: number) {
    if (blockerId === blockedId) {
      throw new ConflictException('You cannot block yourself');
    }

    // Check user existence, block status, and follow status in parallel
    const [userToBlock, existingBlock, existingFollow, existingFollowRev] = await Promise.all([
      this.prismaService.user.findUnique({
        where: { id: blockedId },
        select: { id: true },
      }),
      this.prismaService.block.findUnique({
        where: {
          blockerId_blockedId: {
            blockerId,
            blockedId,
          },
        },
      }),
      this.prismaService.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: blockerId,
            followingId: blockedId,
          },
        },
      }),
      this.prismaService.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: blockedId,
            followingId: blockerId,
          },
        },
      }),
    ]);

    if (!userToBlock) {
      throw new NotFoundException('User not found');
    }

    if (existingBlock) {
      throw new ConflictException('You have already blocked this user');
    }

    // If following, unfollow and block in a transaction
    if (existingFollow && existingFollowRev) {
      const [, block] = await this.prismaService.$transaction([
        this.prismaService.follow.delete({
          where: {
            followerId_followingId: {
              followerId: blockerId,
              followingId: blockedId,
            },
          },
        }),
        this.prismaService.block.create({
          data: {
            blockerId,
            blockedId,
          },
        }),
        this.prismaService.follow.delete({
          where: {
            followerId_followingId: {
              followerId: blockedId,
              followingId: blockerId,
            },
          },
        }),
      ]);
      return block;
    } else if (existingFollow) {
      await this.prismaService.$transaction([
        this.prismaService.follow.delete({
          where: {
            followerId_followingId: {
              followerId: blockerId,
              followingId: blockedId,
            },
          },
        }),
        this.prismaService.block.create({
          data: {
            blockerId,
            blockedId,
          },
        }),
      ]);
      return;
    } else if (existingFollowRev) {
      await this.prismaService.$transaction([
        this.prismaService.follow.delete({
          where: {
            followerId_followingId: {
              followerId: blockedId,
              followingId: blockerId,
            },
          },
        }),
        this.prismaService.block.create({
          data: {
            blockerId,
            blockedId,
          },
        }),
      ]);
    }

    // Otherwise, just block
    return this.prismaService.block.create({
      data: {
        blockerId,
        blockedId,
      },
    });
  }

  async unblockUser(blockerId: number, blockedId: number) {
    if (blockerId === blockedId) {
      throw new ConflictException('You cannot unblock yourself');
    }

    const existingBlock = await this.prismaService.block.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId,
          blockedId,
        },
      },
    });

    if (!existingBlock) {
      throw new ConflictException('You have not blocked this user');
    }

    return this.prismaService.block.delete({
      where: {
        blockerId_blockedId: {
          blockerId,
          blockedId,
        },
      },
    });
  }

  async getBlockedUsers(userId: number, page: number = 1, limit: number = 10) {
    const [totalItems, blockedUsers] = await this.prismaService.$transaction([
      this.prismaService.block.count({
        where: { blockerId: userId },
      }),
      this.prismaService.block.findMany({
        where: { blockerId: userId },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          Blocked: {
            select: {
              id: true,
              username: true,
              Profile: { select: { name: true, bio: true, profile_image_url: true } },
            },
          },
        },
      }),
    ]);

    const data = blockedUsers.map((block) => ({
      id: block.Blocked.id,
      username: block.Blocked.username,
      displayName: block.Blocked.Profile?.name || null,
      bio: block.Blocked.Profile?.bio || null,
      profileImageUrl: block.Blocked.Profile?.profile_image_url || null,
      blockedAt: block.createdAt,
    }));

    const metadata = {
      totalItems,
      page,
      limit,
      totalPages: Math.ceil(totalItems / limit),
    };

    return { data, metadata };
  }

  async muteUser(muterId: number, mutedId: number) {
    if (muterId === mutedId) {
      throw new ConflictException('You cannot mute yourself');
    }

    const [userToMute, existingMute] = await Promise.all([
      this.prismaService.user.findUnique({
        where: { id: mutedId },
        select: { id: true },
      }),
      this.prismaService.mute.findUnique({
        where: {
          muterId_mutedId: {
            muterId,
            mutedId,
          },
        },
      }),
    ]);

    if (!userToMute) {
      throw new NotFoundException('User not found');
    }

    if (existingMute) {
      throw new ConflictException('You have already muted this user');
    }

    return this.prismaService.mute.create({
      data: {
        muterId,
        mutedId,
      },
    });
  }

  async unmuteUser(muterId: number, mutedId: number) {
    if (muterId === mutedId) {
      throw new ConflictException('You cannot unmute yourself');
    }

    const existingMute = await this.prismaService.mute.findUnique({
      where: {
        muterId_mutedId: {
          muterId,
          mutedId,
        },
      },
    });

    if (!existingMute) {
      throw new ConflictException('You have not muted this user');
    }

    return this.prismaService.mute.delete({
      where: {
        muterId_mutedId: {
          muterId,
          mutedId,
        },
      },
    });
  }

  async getMutedUsers(userId: number, page: number = 1, limit: number = 10) {
    const [totalItems, mutedUsers] = await this.prismaService.$transaction([
      this.prismaService.mute.count({
        where: { muterId: userId },
      }),
      this.prismaService.mute.findMany({
        where: { muterId: userId },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          Muted: {
            select: {
              id: true,
              username: true,
              Profile: { select: { name: true, bio: true, profile_image_url: true } },
            },
          },
        },
      }),
    ]);

    const data = mutedUsers.map((mute) => ({
      id: mute.Muted.id,
      username: mute.Muted.username,
      displayName: mute.Muted.Profile?.name || null,
      bio: mute.Muted.Profile?.bio || null,
      profileImageUrl: mute.Muted.Profile?.profile_image_url || null,
      mutedAt: mute.createdAt,
    }));

    const metadata = {
      totalItems,
      page,
      limit,
      totalPages: Math.ceil(totalItems / limit),
    };

    return { data, metadata };
  }

  public async getSuggestedUsers(
    userId?: number,
    limit: number = 10,
    excludeFollowed: boolean = !!userId,
    excludeBlocked: boolean = !!userId,
  ): Promise<SuggestedUserDto[]> {
    const suggestedUsers = await this.prismaService.user.findMany({
      where: {
        // Exclude current user if provided
        ...(userId && { id: { not: userId } }),

        deleted_at: null,
        Profile: {
          is_deactivated: false,
        },

        // Exclude already followed users (only if userId provided and flag is true)
        ...(userId &&
          excludeFollowed && {
            Followers: {
              none: {
                followerId: userId,
              },
            },
          }),

        // Exclude blocked users (only if userId provided and flag is true)
        ...(userId &&
          excludeBlocked && {
            Blockers: {
              none: {
                blockerId: userId,
              },
            },
            Blocked: {
              none: {
                blockedId: userId,
              },
            },
          }),
      },
      select: {
        id: true,
        username: true,
        email: true,
        is_verified: true,
        Profile: {
          select: {
            name: true,
            bio: true,
            profile_image_url: true,
            banner_image_url: true,
            location: true,
            website: true,
          },
        },
        _count: {
          select: {
            Followers: true,
          },
        },
      },
      orderBy: [
        {
          Followers: {
            _count: 'desc',
          },
        },
      ],
      take: limit,
    });

    return suggestedUsers.map((user) => ({
      id: user.id,
      username: user.username,
      email: user.email,
      isVerified: user.is_verified,
      profile: user.Profile
        ? {
            name: user.Profile.name,
            bio: user.Profile.bio,
            profileImageUrl: user.Profile.profile_image_url,
            bannerImageUrl: user.Profile.banner_image_url,
            location: user.Profile.location,
            website: user.Profile.website,
          }
        : null,
      followersCount: user._count.Followers,
    }));
  }

  async getUserInterests(userId: number): Promise<UserInterestDto[]> {
    const userInterests = await this.prismaService.userInterest.findMany({
      where: {
        user_id: userId,
      },
      include: {
        interest: {
          select: {
            id: true,
            name: true,
            slug: true,
            icon: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return userInterests.map((ui) => ({
      id: ui.interest.id,
      name: INTEREST_SLUG_TO_ENUM[ui.interest.slug] || (ui.interest.name as UserInterest),
      slug: ui.interest.slug,
      icon: ui.interest.icon,
      selectedAt: ui.created_at,
    }));
  }

  async saveUserInterests(userId: number, interestIds: number[]): Promise<number> {
    if (interestIds.length === 0) {
      throw new BadRequestException('At least one interest must be selected');
    }

    const existingInterests = await this.prismaService.interest.findMany({
      where: {
        id: { in: interestIds },
        is_active: true,
      },
    });

    if (existingInterests.length !== interestIds.length) {
      throw new BadRequestException('One or more interest IDs are invalid');
    }

    await this.prismaService.$transaction(async (tx) => {
      await tx.userInterest.deleteMany({
        where: {
          user_id: userId,
        },
      });

      await tx.userInterest.createMany({
        data: interestIds.map((interestId) => ({
          user_id: userId,
          interest_id: interestId,
        })),
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          has_completed_interests: true,
        },
      });
    });
    return interestIds.length;
  }

  async getAllInterests(): Promise<InterestDto[]> {
    const cached = await this.redisService.get(this.INTERESTS_CACHE_KEY);

    if (cached) {
      return JSON.parse(cached);
    }
    const interests = await this.prismaService.interest.findMany({
      where: {
        is_active: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        icon: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    await this.redisService.set(
      this.INTERESTS_CACHE_KEY,
      JSON.stringify(interests),
      this.CACHE_TTL,
    );
    return interests;
  }

  public async getFollowingCount(userId: number) {
    return this.prismaService.follow.count({ where: { followerId: userId } });
  }
}
