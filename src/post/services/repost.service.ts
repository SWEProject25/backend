import { Inject, Injectable, NotFoundException, forwardRef } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Services } from 'src/utils/constants';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationType } from 'src/notifications/enums/notification.enum';
import { PostService } from './post.service';

@Injectable()
export class RepostService {
  constructor(
    @Inject(Services.PRISMA)
    private readonly prismaService: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(forwardRef(() => Services.POST))
    private readonly postService: PostService,
  ) {}

  async toggleRepost(postId: number, userId: number) {
    return this.prismaService.$transaction(async (tx) => {
      const repost = await tx.repost.findUnique({
        where: { post_id_user_id: { post_id: postId, user_id: userId } },
      });

      if (repost) {
        await tx.repost.delete({
          where: { post_id_user_id: { post_id: postId, user_id: userId } },
        });

        // Update/create cache and emit WebSocket event
        await this.postService.updatePostStatsCache(postId, 'retweetsCount', -1);

        return { message: 'Repost removed' };
      } else {
        // Fetch post to get author for notification
        const post = await tx.post.findUnique({
          where: { id: postId },
          select: { user_id: true },
        });

        await tx.repost.create({
          data: { post_id: postId, user_id: userId },
        });

        // Update/create cache and emit WebSocket event
        await this.postService.updatePostStatsCache(postId, 'retweetsCount', 1);

        // Emit notification event (don't notify yourself)
        if (post && post.user_id !== userId) {
          this.eventEmitter.emit('notification.create', {
            type: NotificationType.REPOST,
            recipientId: post.user_id,
            actorId: userId,
            postId,
          });
        }

        return { message: 'Post reposted' };
      }
    });
  }

  async getReposters(postId: number, page: number, limit: number) {
    return this.prismaService.repost.findMany({
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
  }
}
