import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Services } from 'src/utils/constants';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationType } from 'src/notifications/enums/notification.enum';

@Injectable()
export class MentionService {
  constructor(
    @Inject(Services.PRISMA)
    private readonly prismaService: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private async checkUserExists(userId: number) {
    const user = await this.prismaService.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
      },
    });
    if (!user) {
      throw new NotFoundException("Given user id doesn't exist");
    }
  }
  private async checkPostExists(postId: number) {
    const post = await this.prismaService.post.findUnique({
      where: {
        id: postId,
      },
      select: {
        id: true,
      },
    });
    if (!post) {
      throw new NotFoundException("Given Post id doesn't exist");
    }
  }

  async mentionUser(userId: number, postId: number) {
    await this.checkUserExists(userId);
    await this.checkPostExists(postId);

    const mention = await this.prismaService.mention.create({
      data: {
        user_id: userId,
        post_id: postId,
      },
    });

    // Fetch post details for notification
    const post = await this.prismaService.post.findUnique({
      where: { id: postId },
      select: { user_id: true, parent_id: true },
    });

    // Emit notification event (don't notify yourself)
    if (post && post.user_id !== userId) {
      this.eventEmitter.emit('notification.create', {
        type: NotificationType.MENTION,
        recipientId: userId,
        actorId: post.user_id,
        postId,
        replyId: post.parent_id ? postId : undefined,
        threadPostId: post.parent_id || undefined,
      });
    }

    return mention;
  }

  async getMentionedPosts(userId: number, page: number, limit: number) {
    const mentions = await this.prismaService.mention.findMany({
      where: { user_id: userId },
      include: { post: true },
      distinct: ['post_id'],
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return mentions.map((mention) => ({
      ...mention.post,
      mentionedAt: mention.created_at,
    }));
  }

  async getMentionsForPost(postId: number, page: number = 1, limit: number = 10) {
    const mentions = await this.prismaService.mention.findMany({
      where: { post_id: postId },
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
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return mentions.map((mention) => mention.user);
  }
}
