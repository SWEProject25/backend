import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Services } from 'src/utils/constants';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationType } from 'src/notifications/enums/notification.enum';
import { PostService } from './post.service';

@Injectable()
export class LikeService {
  constructor(
    @Inject(Services.PRISMA)
    private readonly prismaService: PrismaService,
    @Inject(Services.POST)
    private readonly postService: PostService,
    private readonly eventEmitter: EventEmitter2,
  ) { }

  async togglePostLike(postId: number, userId: number) {
    await this.postService.checkPostExists(postId);

    const existingLike = await this.prismaService.like.findUnique({
      where: {
        post_id_user_id: {
          post_id: postId,
          user_id: userId,
        },
      },
    });
    if (existingLike) {
      await this.prismaService.like.delete({
        where: {
          post_id_user_id: {
            post_id: postId,
            user_id: userId,
          },
        },
      });

      // Update/create cache and emit WebSocket event
      await this.postService.updatePostStatsCache(postId, 'likesCount', -1);

      return { liked: false, message: 'Post unliked' };
    }

    // Fetch post to get author for notification
    const post = await this.prismaService.post.findUnique({
      where: { id: postId },
      select: { user_id: true },
    });

    await this.prismaService.like.create({
      data: {
        post_id: postId,
        user_id: userId,
      },
    });

    // Update/create cache and emit WebSocket event
    await this.postService.updatePostStatsCache(postId, 'likesCount', 1);

    // Emit notification event (don't notify yourself)
    if (post && post.user_id !== userId) {
      this.eventEmitter.emit('notification.create', {
        type: NotificationType.LIKE,
        recipientId: post.user_id,
        actorId: userId,
        postId,
      });
    }

    return { liked: true, message: 'Post liked' };
  }

  async getListOfLikers(postId: number, page: number, limit: number) {
    const likers = await this.prismaService.like.findMany({
      where: {
        post_id: postId,
      },
      select: {
        user: {
          select: {
            id: true,
            username: true,
            is_verified: true,
            Profile: {
              select: {
                name: true,
                profile_image_url: true
              }
            }
          },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    return likers.map(liker => ({
      id: liker.user.id,
      username: liker.user.username,
      verified: liker.user.is_verified,
      name: liker.user.Profile?.name,
      profileImageUrl: liker.user.Profile?.profile_image_url
    }))
  }

  async getLikedPostsByUser(userId: number, page: number, limit: number) {
    const likes = await this.prismaService.like.findMany({
      where: { user_id: userId },
      select: { post_id: true, created_at: true },
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const likedPostsIds = likes.map((like) => like.post_id);

    const likedPosts = await this.postService.findPosts({
      where: {
        is_deleted: false,
        id: { in: likedPostsIds },
      },
      userId,
      limit,
      page,
    });
    const orderMap = new Map(likes.map((m, index) => [m.post_id, index]));

    likedPosts.sort((a, b) => orderMap.get(a.postId)! - orderMap.get(b.postId)!);
    return likedPosts;
  }
}
