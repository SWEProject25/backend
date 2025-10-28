import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Services } from 'src/utils/constants';
import { CreatePostDto } from '../dto/create-post.dto';
import { PostFiltersDto } from '../dto/post-filter.dto';
import { MediaType, Post, PostType, PostVisibility } from 'generated/prisma';
import { StorageService } from 'src/storage/storage.service';

@Injectable()
export class PostService {
  constructor(
    @Inject(Services.PRISMA)
    private readonly prismaService: PrismaService,
    @Inject(Services.STORAGE)
    private readonly storageService: StorageService
  ) {}

  private extractHashtags(content: string): string[] {
    if (!content) return [];

    const matches = content.match(/#(\w+)/g);

    if (!matches) return [];

    return [...new Set(matches.map((tag) => tag.slice(1).toLowerCase()))];
  }

  private getMediaWithType(urls: string[], media: Express.Multer.File[]) {
    return urls.map((url, index) => ({
      url, type: media[index].mimetype.startsWith('video')
        ? MediaType.VIDEO
        : MediaType.IMAGE
    }))
  }

  private async createPostTransaction(
    postData: CreatePostDto,
    hashtags: string[],
    mediaWithType: { url: string; type: MediaType }[],
  ) {
    return this.prismaService.$transaction(async (tx) => {
      // Upsert hashtags
      const hashtagRecords = await Promise.all(
        hashtags.map(tag =>
          tx.hashtag.upsert({
            where: { tag },
            update: {},
            create: { tag },
          }),
        ),
      );

      // Create post
      const post = await tx.post.create({
        data: {
          content: postData.content,
          type: postData.type,
          parent_id: postData.parentId,
          visibility: postData.visibility,
          user_id: postData.userId,
          hashtags: {
            connect: hashtagRecords.map(record => ({ id: record.id })),
          },
        },
        include: { hashtags: true },
      });

      // Create media entries
      await tx.media.createMany({
        data: mediaWithType.map(m => ({
          post_id: post.id,
          media_url: m.url,
          type: m.type,
        })),
      });

      return { ...post, mediaUrls: mediaWithType.map(m => m.url) };
    });
  }


  async createPost(createPostDto: CreatePostDto, media: Express.Multer.File[]) {
    let urls: string[] = [];
    try {
      const { content } = createPostDto;
      urls = await this.storageService.uploadFiles(media)

      const hashtags = this.extractHashtags(content)

      const mediaWithType = this.getMediaWithType(urls, media)

      const post = await this.createPostTransaction(
        createPostDto,
        hashtags,
        mediaWithType,
      );
      return post;

    } catch (error) {
      // deleting uploaded files in case of any error
      await this.storageService.deleteFiles(urls);
      throw error;
    }
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

  private async getPosts(
    userId: number,
    page: number,
    limit: number,
    types: PostType[],
    visibility?: PostVisibility,
  ) {
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

  private async getReposts(
    userId: number,
    page: number,
    limit: number,
    visibility?: PostVisibility,
  ) {
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

  private getTopPaginatedPosts(
    posts: Post[],
    reposts: { post: Post; created_at: Date }[],
    page: number,
    limit: number,
  ) {
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

    combined.sort((a, b) => new Date(b.reposted_at).getTime() - new Date(a.reposted_at).getTime());

    const start = (page - 1) * limit;
    const end = start + limit;
    const paginated = combined.slice(start, end);

    return paginated;
  }

  async getUserPosts(userId: number, page: number, limit: number, visibility?: PostVisibility) {
    // includes reposts, posts, and quotes
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
    return this.prismaService.$transaction(async (tx) => {
      const post = await tx.post.findUnique({
        where: { id: postId, is_deleted: false },
      });

      if (!post) {
        throw new NotFoundException('Post not found');
      }

      const repliesAndQuotes = await tx.post.findMany({
        where: { parent_id: postId, is_deleted: false },
        select: { id: true },
      });

      const postIds = [postId, ...repliesAndQuotes.map((r) => r.id)];

      await tx.mention.deleteMany({
        where: { post_id: { in: postIds } },
      });
      await tx.like.deleteMany({
        where: { post_id: { in: postIds } },
      });
      await tx.repost.deleteMany({
        where: { post_id: { in: postIds } },
      });

      return tx.post.updateMany({
        where: { id: { in: postIds } },
        data: { is_deleted: true },
      });
    });
  }

  async getUserTimeline(userId: number, page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    // Tunable weights — can be adjusted dynamically later
    const wIsFollowing = 1.2;
    const wIsMine = 1.5;
    const wLikes = 0.35;
    const wReposts = 0.25;
    const wReplies = 0.15;
    const wMentions = 0.1;
    const wQuotes = 0.05;
    const wFreshness = 0.1;
    const T = 2.0; // decay time (hours)

    const posts = await this.prismaService.$queryRawUnsafe(`
    WITH following AS (
      SELECT "followingId" AS id FROM "follows" WHERE "followerId" = ${userId}
    ),
    agg AS (
      SELECT
        p."id",
        p."user_id",
        p."content",
        p."type",
        p."parent_id",
        p."visibility",
        p."created_at",
        p."is_deleted",
        u."username",
        pr."name" AS profile_name,
        pr."profile_image_url",

        -- Relationship flags
        (p."user_id" = ${userId}) AS is_mine,
        EXISTS(SELECT 1 FROM following f WHERE f.id = p."user_id") AS is_following,


        -- Engagement counts
        COUNT(DISTINCT l."user_id")::int AS likes_count,
        COUNT(DISTINCT r."user_id")::int AS reposts_count,
        COUNT(DISTINCT m."id")::int AS mentions_count,
        COUNT(DISTINCT reply."id") FILTER (WHERE reply."type" = 'REPLY')::int AS replies_count,
        COUNT(DISTINCT quote."id") FILTER (WHERE quote."type" = 'QUOTE')::int AS quotes_count,

        EXTRACT(EPOCH FROM (NOW() - p."created_at")) / 3600.0 AS hours_since
      FROM "posts" p
      LEFT JOIN "User" u ON u."id" = p."user_id"
      LEFT JOIN "profiles" pr ON pr."user_id" = u."id"
      LEFT JOIN "Like" l ON l."post_id" = p."id"
      LEFT JOIN "Repost" r ON r."post_id" = p."id"
      LEFT JOIN "Mention" m ON m."post_id" = p."id"
      LEFT JOIN "posts" reply ON reply."parent_id" = p."id"
      LEFT JOIN "posts" quote ON quote."parent_id" = p."id"

      WHERE p."is_deleted" = FALSE
      GROUP BY p."id", p."user_id", p."content", p."type", p."parent_id", 
               p."visibility", p."created_at", p."is_deleted",
               u."username", pr."name", pr."profile_image_url"
    )
    SELECT 
      *,
      (
        ${wIsMine} * (CASE WHEN is_mine THEN 1 ELSE 0 END) +
        ${wIsFollowing} * (CASE WHEN is_following THEN 1 ELSE 0 END) +
        ${wLikes} * LN(1 + likes_count) +
        ${wReposts} * LN(1 + reposts_count) +
        ${wReplies} * LN(1 + COALESCE(replies_count, 0)) +
        ${wMentions} * LN(1 + COALESCE(mentions_count, 0)) +
        ${wQuotes} * LN(1 + COALESCE(quotes_count, 0)) +
        ${wFreshness} * (1.0 / (1.0 + (hours_since / ${T})))
      )::double precision AS score
    FROM agg
    ORDER BY score DESC
    LIMIT ${limit} OFFSET ${offset};
  `);

    return posts;
  }
}
