import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Services } from 'src/utils/constants';
import { PostService } from './post.service';

@Injectable()
export class MentionService {
  constructor(
    @Inject(Services.PRISMA)
    private readonly prismaService: PrismaService,
    @Inject(Services.POST)
    private readonly postService: PostService,
  ) {}

  async getMentionedPosts(userId: number, page: number, limit: number) {
    const mentions = await this.prismaService.mention.findMany({
      where: { user_id: userId },
      select: { post_id: true, created_at: true },
      distinct: ['post_id'],
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const postsIds = mentions.map((mention) => mention.post_id);

    const mentionPosts = await this.postService.findPosts({
      where: {
        is_deleted: false,
        id: { in: postsIds },
      },
      userId,
      limit,
      page,
    });

    return mentionPosts;
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
