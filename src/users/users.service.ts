import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Services } from 'src/utils/constants';

@Injectable()
export class UsersService {
  constructor(
    @Inject(Services.PRISMA)
    private readonly prismaService: PrismaService,
  ) {}

  async followUser(followerId: number, followingId: number) {
    if (followerId === followingId) {
      throw new ConflictException('You cannot follow yourself');
    }

    // Check user existence and follow status in parallel
    const [userToFollow, existingFollow] = await Promise.all([
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
    ]);

    if (!userToFollow) {
      throw new NotFoundException('User not found');
    }

    if (existingFollow) {
      throw new ConflictException('You are already following this user');
    }

    return this.prismaService.follow.create({
      data: {
        followerId,
        followingId,
      },
    });
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

    return this.prismaService.follow.delete({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });
  }

  async getFollowers(userId: number, page: number = 1, limit: number = 10) {
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

    const data = followers.map((follow) => ({
      id: follow.Follower.id,
      username: follow.Follower.username,
      displayName: follow.Follower.Profile?.name || null,
      bio: follow.Follower.Profile?.bio || null,
      profileImageUrl: follow.Follower.Profile?.profile_image_url || null,
      followedAt: follow.createdAt,
    }));

    const metadata = {
      totalItems,
      page,
      limit,
      totalPages: Math.ceil(totalItems / limit),
    };

    return { data, metadata };
  }

  async getFollowing(userId: number, page: number = 1, limit: number = 10) {
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

    const data = following.map((follow) => ({
      id: follow.Following.id,
      username: follow.Following.username,
      displayName: follow.Following.Profile?.name || null,
      bio: follow.Following.Profile?.bio || null,
      profileImageUrl: follow.Following.Profile?.profile_image_url || null,
      followedAt: follow.createdAt,
    }));

    const metadata = {
      totalItems,
      page,
      limit,
      totalPages: Math.ceil(totalItems / limit),
    };

    return { data, metadata };
  }

  async blockUser(blockerId: number, blockedId: number) {
    if (blockerId === blockedId) {
      throw new ConflictException('You cannot block yourself');
    }

    // Check user existence, block status, and follow status in parallel
    const [userToBlock, existingBlock, existingFollow] = await Promise.all([
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
    ]);

    if (!userToBlock) {
      throw new NotFoundException('User not found');
    }

    if (existingBlock) {
      throw new ConflictException('You have already blocked this user');
    }

    // If following, unfollow and block in a transaction
    if (existingFollow) {
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
      ]);
      return block;
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
}
