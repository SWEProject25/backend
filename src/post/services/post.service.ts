import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Services } from 'src/utils/constants';
import { CreatePostDto } from '../dto/create-post.dto';
import { PostFiltersDto } from '../dto/post-filter.dto';
import { Post, PostType, PostVisibility } from 'generated/prisma';

@Injectable()
export class PostService {

  constructor(
    @Inject(Services.PRISMA)
    private readonly prismaService: PrismaService,
  ) { }

  async createPost(createPostDto: CreatePostDto) {
    const { content, type, parentId, visibility, userId } = createPostDto;

    return this.prismaService.post.create({
      data: {
        content,
        type,
        parent_id: parentId,
        visibility,
        user_id: userId,
      },
    });
  }

  async getPostsWithFilters(filter: PostFiltersDto) {
    const { userId, hashtag, type, page, limit } = filter;

    const hasFilters = userId || hashtag || type;

    const where = hasFilters
      ? {
        ...(userId && { user_id: userId }),
        ...(hashtag && { hashtags: { some: { tag: hashtag } } }),
        ...(type && { type }),
        is_deleted: false,
      }
      : {
        // TODO: improve this fallback
        visibility: PostVisibility.EVERY_ONE, // fallback: only public posts
        is_deleted: false,
      };


    const posts = await this.prismaService.post.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
    });

    return posts;
  }

  private async getPosts(userId: number, page: number, limit: number, types: PostType[], visibility?: PostVisibility) {
    return this.prismaService.post.findMany({
      where: {
        user_id: userId,
        is_deleted: false,
        type: { in: types },
        ...(visibility && { visibility }),
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  private async getReposts(userId: number, page: number, limit: number, visibility?: PostVisibility) {
    return this.prismaService.repost.findMany({
      where: {
        user_id: userId,
        post: {
          is_deleted: false,
          ...(visibility && { visibility }),
        },
      },
      select: {
        post: true,
        created_at: true,
      },

      skip: (page - 1) * limit,
      take: limit,
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  private getTopPaginatedPosts(posts: Post[], reposts: { post: Post, created_at: Date }[], page: number, limit: number) {
    const combined = [
      ...posts.map((p) => ({
        ...p,
        isRepost: false,
        reposted_at: p.created_at,
      })),
      ...reposts.map((r) => ({
        ...r.post,
        isRepost: true,
        reposted_at: r.created_at,
      })),
    ];

    combined.sort(
      (a, b) =>
        new Date(b.reposted_at).getTime() - new Date(a.reposted_at).getTime(),
    );

    const start = (page - 1) * limit;
    const end = start + limit;
    const paginated = combined.slice(start, end);

    return paginated;
  }

  async getUserPosts(userId: number, page: number, limit: number, visibility?: PostVisibility) { // includes reposts, posts, and quotes
    const [posts, reposts] = await Promise.all([
      this.getPosts(userId, page, limit, [PostType.POST, PostType.QUOTE], visibility),
      this.getReposts(userId, page, limit, visibility),
    ]);
    // TODO: Remove in memory sorting and pagination
    return this.getTopPaginatedPosts(posts, reposts, page, limit);
  }

  async getUserReplies(userId: number, page: number, limit: number, visibility?: PostVisibility) {
    return this.getPosts(userId, page, limit, [PostType.REPLY], visibility);
  }

  async getRepliesOfPost(postId: number, page: number, limit: number) {
    return this.prismaService.post.findMany({
      where: {
        type: PostType.REPLY,
        parent_id: postId,
        is_deleted: false,
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  async deletePost(postId: number) {
    const post = await this.prismaService.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }
    const repliesAndQuotes = await this.prismaService.post.findMany({
      where: {
        parent_id: postId,
        is_deleted: false
      },
      select: {
        id: true,
      },
    });
    // TODO: Complete the deletion process
    return this.prismaService.post.updateMany({
      where: {
        id: {
          in: [postId, ...repliesAndQuotes.map((reply) => reply.id)],
        },
      },
      data: {
        is_deleted: true,
      },
    });
  }
}