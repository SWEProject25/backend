import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Services } from 'src/utils/constants';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationType } from 'src/notifications/enums/notification.enum';

@Injectable()
export class LikeService {
  constructor(
    @Inject(Services.PRISMA)
    private readonly prismaService: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async togglePostLike(postId: number, userId: number) {
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
            email: true,
            is_verified: true,
          },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    return likers.map((like) => like.user);
  }

  async getLikedPostsByUser(userId: number, page: number, limit: number) {
    const likes = await this.prismaService.like.findMany({
      where: { user_id: userId },
      include: { post: true },
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return likes.map((like) => ({
      ...like.post,
      liked_at: like.created_at,
    }));
  }
}
