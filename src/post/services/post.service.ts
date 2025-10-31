import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Services } from 'src/utils/constants';
import { CreatePostDto } from '../dto/create-post.dto';
import { PostFiltersDto } from '../dto/post-filter.dto';
import { SearchPostsDto } from '../dto/search-posts.dto';
import { SearchByHashtagDto } from '../dto/search-by-hashtag.dto';
import { MediaType, Post, PostType, PostVisibility, Prisma as PrismalSql } from 'generated/prisma';
import { StorageService } from 'src/storage/storage.service';

import { MLService } from './ml.service';
import { Prisma } from '@prisma/client';

// This interface now reflects the complex object returned by our query
export interface PostWithAllData extends Post {
  personalizationScore: number;
  hasMedia: boolean;
  hashtagCount: number;
  mentionCount: number;
  isVerified: boolean;
  followersCount: number;
  followingCount: number;
  postsCount: number;
}

@Injectable()
export class PostService {
  constructor(
    @Inject(Services.PRISMA)
    private readonly prismaService: PrismaService,
    @Inject(Services.STORAGE)
    private readonly storageService: StorageService,
    private readonly mlService: MLService,
  ) {}

  private extractHashtags(content: string): string[] {
    if (!content) return [];

    const matches = content.match(/#(\w+)/g);

    if (!matches) return [];

    return [...new Set(matches.map((tag) => tag.slice(1).toLowerCase()))];
  }

  private getMediaWithType(urls: string[], media?: Express.Multer.File[]) {
    if (urls.length === 0) return [];
    return urls.map((url, index) => ({
      url,
      type: media?.[index]?.mimetype.startsWith('video') ? MediaType.VIDEO : MediaType.IMAGE,
    }));
  }

  private async createPostTransaction(
    postData: CreatePostDto,
    hashtags: string[],
    mediaWithType: { url: string; type: MediaType }[],
  ) {
    return this.prismaService.$transaction(async (tx) => {
      // Upsert hashtags
      const hashtagRecords = await Promise.all(
        hashtags.map((tag) =>
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
            connect: hashtagRecords.map((record) => ({ id: record.id })),
          },
        },
        include: { hashtags: true },
      });

      // Create media entries
      await tx.media.createMany({
        data: mediaWithType.map((m) => ({
          post_id: post.id,
          media_url: m.url,
          type: m.type,
        })),
      });

      return { ...post, mediaUrls: mediaWithType.map((m) => m.url) };
    });
  }

  async createPost(createPostDto: CreatePostDto) {
    let urls: string[] = [];
    try {
      const { content, media } = createPostDto;
      urls = await this.storageService.uploadFiles(media);

      const hashtags = this.extractHashtags(content);

      const mediaWithType = this.getMediaWithType(urls, media);

      const post = await this.createPostTransaction(createPostDto, hashtags, mediaWithType);
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

  async searchPosts(searchDto: SearchPostsDto) {
    const {
      searchQuery,
      userId,
      type,
      page = 1,
      limit = 10,
      similarityThreshold = 0.1,
    } = searchDto;
    const offset = (page - 1) * limit;

    const countResult = await this.prismaService.$queryRaw<[{ count: bigint }]>(
      PrismalSql.sql`
        SELECT COUNT(DISTINCT p.id) as count
        FROM posts p
        WHERE 
          p.is_deleted = false
          ${userId ? PrismalSql.sql`AND p.user_id = ${userId}` : PrismalSql.empty}
          ${type ? PrismalSql.sql`AND p.type = ${type}::"PostType"` : PrismalSql.empty}
          AND similarity(p.content, ${searchQuery}) > ${similarityThreshold}
      `,
    );

    const totalItems = Number(countResult[0]?.count || 0);

    const posts = await this.prismaService.$queryRaw<any[]>(
      PrismalSql.sql`
        SELECT 
          p.*,
          similarity(p.content, ${searchQuery}) as relevance,
          json_build_object(
            'id', u.id,
            'username', u.username,
            'name', pr.name,
            'profile_image_url', pr.profile_image_url
          ) as "User",
          COALESCE(
            json_agg(
              DISTINCT jsonb_build_object('media_url', m.media_url, 'type', m.type)
            ) FILTER (WHERE m.id IS NOT NULL),
            '[]'
          ) as media,
          json_build_object(
            'likes', COUNT(DISTINCT l.user_id),
            'repostedBy', COUNT(DISTINCT r.user_id),
            'Replies', COUNT(DISTINCT reply.id)
          ) as "_count"
        FROM posts p
        LEFT JOIN "User" u ON u.id = p.user_id
        LEFT JOIN profiles pr ON pr.user_id = u.id
        LEFT JOIN media m ON m.post_id = p.id
        LEFT JOIN "Like" l ON l.post_id = p.id
        LEFT JOIN "Repost" r ON r.post_id = p.id
        LEFT JOIN posts reply ON reply.parent_id = p.id AND reply.type = 'REPLY'
        WHERE 
          p.is_deleted = false
          ${userId ? PrismalSql.sql`AND p.user_id = ${userId}` : PrismalSql.empty}
          ${type ? PrismalSql.sql`AND p.type = ${type}::"PostType"` : PrismalSql.empty}
          AND similarity(p.content, ${searchQuery}) > ${similarityThreshold}
        GROUP BY p.id, u.id, u.username, pr.name, pr.profile_image_url
        ORDER BY 
          relevance DESC, 
          p.created_at DESC
        LIMIT ${limit} 
        OFFSET ${offset}
      `,
    );

    return {
      posts,
      totalItems,
      page,
      limit,
    };
  }

  async searchPostsByHashtag(searchDto: SearchByHashtagDto) {
    const { hashtag, userId, type, page = 1, limit = 10 } = searchDto;
    const offset = (page - 1) * limit;

    // Normalize hashtag (remove # if present and convert to lowercase)
    const normalizedHashtag = hashtag.startsWith('#')
      ? hashtag.slice(1).toLowerCase()
      : hashtag.toLowerCase();

    // Count total posts with this hashtag
    const countResult = await this.prismaService.post.count({
      where: {
        is_deleted: false,
        hashtags: {
          some: {
            tag: normalizedHashtag,
          },
        },
        ...(userId && { user_id: userId }),
        ...(type && { type }),
      },
    });

    // Get posts with the hashtag
    const posts = await this.prismaService.post.findMany({
      where: {
        is_deleted: false,
        hashtags: {
          some: {
            tag: normalizedHashtag,
          },
        },
        ...(userId && { user_id: userId }),
        ...(type && { type }),
      },
      include: {
        User: {
          select: {
            id: true,
            username: true,
            Profile: {
              select: {
                name: true,
                profile_image_url: true,
              },
            },
          },
        },
        hashtags: {
          select: {
            id: true,
            tag: true,
          },
        },
        media: {
          select: {
            media_url: true,
            type: true,
          },
        },
        _count: {
          select: {
            likes: true,
            repostedBy: true,
            Replies: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
      skip: offset,
      take: limit,
    });

    return {
      posts,
      totalItems: countResult,
      page,
      limit,
      hashtag: normalizedHashtag,
    };
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
      const post = await tx.post.findFirst({
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

  async getFollowingForFeed(userId: number, page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    // Tunable weights — can be adjusted dynamically later
    const wIsFollowing = 1.2;
    const wIsMine = 1.5;
    const wLikes = 0.35;
    const wReposts = 0.35;
    const wReplies = 0.15;
    const wQuotes = 0.2;
    const wMentions = 0.1;
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
        TRUE AS is_following, -- This will always be true now based on the new WHERE clause


        -- Engagement counts
        COUNT(DISTINCT l."user_id")::int AS likes_count,
        COUNT(DISTINCT r."user_id")::int AS reposts_count,
        COUNT(DISTINCT m."id")::int AS mentions_count,
        COUNT(DISTINCT reply."id") FILTER (WHERE reply."type" = 'REPLY')::int AS replies_count,
        COUNT(DISTINCT quote."id") FILTER (WHERE quote."type" = 'QUOTE')::int AS quotes_count,

        EXTRACT(EPOCH FROM (NOW() - p."created_at")) / 3600.0 AS hours_since
      FROM "posts" p
      INNER JOIN "User" u ON u."id" = p."user_id"
      -- Only join posts from users the current user is following
      INNER JOIN following f ON p."user_id" = f.id
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

  async getPostById(postId: number) {
    const post = await this.prismaService.post.findFirst({
      where: { id: postId, is_deleted: false },
      include: {
        _count: {
          select: {
            likes: true,
            repostedBy: true,
            Replies: true,
          },
        },
        User: {
          select: {
            id: true,
            username: true,
          },
        },
        media: {
          select: {
            media_url: true,
            type: true,
          },
        },
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    return post;
  }

  async getForYouFeed(userId: number): Promise<{ posts: PostWithAllData[] }> {
    const qualityWeight = 0.4;
    const personalizationWeight = 0.6;

    const candidatePosts: PostWithAllData[] = await this.GetPersonalizedFeedPosts(userId);

    const postsForML = candidatePosts.map((p) => ({
      postId: p.id,
      contentLength: p.content?.length || 0,
      hasMedia: !!p.hasMedia,
      hashtagCount: Number(p.hashtagCount || 0),
      mentionCount: Number(p.mentionCount || 0),
      author: {
        authorId: p.user_id,
        authorFollowersCount: Number(p.followersCount || 0),
        authorFollowingCount: Number(p.followingCount || 0),
        authorTweetCount: Number(p.postsCount || 0),
        authorIsVerified: !!p.isVerified,
      },
    }));

    const qualityScores = await this.mlService.getQualityScores(postsForML);

    const rankedPosts = this.rankPostsHybrid(
      candidatePosts,
      qualityScores,
      qualityWeight,
      personalizationWeight,
    );

    return { posts: rankedPosts };
  }

  private async GetPersonalizedFeedPosts(userId: number) {
    const personalizationWeights = {
      following: 20.0,
      directLike: 15.0,
      commonLike: 8.0,
      commonFollow: 5.0,
    };

    const query = `
    WITH user_follows AS (
      SELECT "followingId" as following_id
      FROM "follows"
      WHERE "followerId" = ${userId}
    ),
    user_blocks AS (
      SELECT "blockedId" as blocked_id
      FROM "blocks"
      WHERE "blockerId" = ${userId}
    ),
    liked_authors AS (
      SELECT DISTINCT p."user_id" as author_id
      FROM "Like" l
      JOIN "posts" p ON l."post_id" = p."id"
      WHERE l."user_id" = ${userId}
    ),
    candidate_posts AS (
      SELECT 
        p."id",
        p."user_id",
        p."content",
        p."created_at",
        p."type",
        p."visibility",
        u."username",
        u."is_verifed" as "isVerified",
        pr."name" as "authorName",
        pr."profile_image_url" as "authorProfileImage",
        COALESCE(engagement."likeCount", 0) as "likeCount",
        COALESCE(engagement."replyCount", 0) as "replyCount",
        COALESCE(engagement."repostCount", 0) as "repostCount",
        author_stats."followersCount",
        author_stats."followingCount",
        author_stats."postsCount",
        CASE WHEN media_check."post_id" IS NOT NULL THEN true ELSE false END as "hasMedia",
        COALESCE(hashtag_count."count", 0) as "hashtagCount",
        COALESCE(mention_count."count", 0) as "mentionCount",
        (
          CASE WHEN uf.following_id IS NOT NULL THEN ${personalizationWeights.following} ELSE 0 END +
          CASE WHEN la.author_id IS NOT NULL THEN ${personalizationWeights.directLike} ELSE 0 END +
          COALESCE(common_likes."count", 0) * ${personalizationWeights.commonLike} +
          CASE WHEN common_follows."exists" THEN ${personalizationWeights.commonFollow} ELSE 0 END
        )::double precision as "personalizationScore"
      FROM "posts" p
      INNER JOIN "User" u ON p."user_id" = u."id"
      LEFT JOIN "profiles" pr ON u."id" = pr."user_id"
      LEFT JOIN user_follows uf ON p."user_id" = uf.following_id
      LEFT JOIN liked_authors la ON p."user_id" = la.author_id
      LEFT JOIN LATERAL (
        SELECT 
          COUNT(DISTINCT l."user_id")::int as "likeCount",
          COUNT(DISTINCT CASE WHEN replies."id" IS NOT NULL THEN replies."id" END)::int as "replyCount",
          COUNT(DISTINCT r."user_id")::int as "repostCount"
        FROM "posts" base
        LEFT JOIN "Like" l ON l."post_id" = base."id"
        LEFT JOIN "posts" replies ON replies."parent_id" = base."id" AND replies."is_deleted" = false
        LEFT JOIN "Repost" r ON r."post_id" = base."id"
        WHERE base."id" = p."id"
      ) engagement ON true
      LEFT JOIN LATERAL (
        SELECT 
          (SELECT COUNT(*)::int FROM "follows" WHERE "followingId" = u."id") as "followersCount",
          (SELECT COUNT(*)::int FROM "follows" WHERE "followerId" = u."id") as "followingCount",
          (SELECT COUNT(*)::int FROM "posts" WHERE "user_id" = u."id" AND "is_deleted" = false) as "postsCount"
      ) author_stats ON true
      LEFT JOIN LATERAL (
        SELECT p."id" as post_id FROM "media" WHERE "post_id" = p."id" LIMIT 1
      ) media_check ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int as count FROM "_PostHashtags" WHERE "B" = p."id"
      ) hashtag_count ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int as count FROM "Mention" WHERE "post_id" = p."id"
      ) mention_count ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::float as count
        FROM "Like" l
        INNER JOIN user_follows uf_likes ON l."user_id" = uf_likes.following_id
        WHERE l."post_id" = p."id"
      ) common_likes ON true
      LEFT JOIN LATERAL (
        SELECT EXISTS(
          SELECT 1 FROM "follows" f
          INNER JOIN user_follows uf_follows ON f."followerId" = uf_follows.following_id
          WHERE f."followingId" = p."user_id"
        ) as exists
      ) common_follows ON true
      WHERE 
        p."is_deleted" = false
        AND p."created_at" > NOW() - INTERVAL '10 days'
        AND NOT EXISTS (SELECT 1 FROM user_blocks ub WHERE ub.blocked_id = p."user_id")
        AND p."user_id" != ${userId}
      ORDER BY "personalizationScore" DESC, p."created_at" DESC
      LIMIT 200
    )
    SELECT * FROM candidate_posts;
  `;

    return await this.prismaService.$queryRawUnsafe<PostWithAllData[]>(query);
  }

  private rankPostsHybrid(
    posts: PostWithAllData[],
    qualityScores: Map<number, number>,
    qualityWeight: number,
    personalizationWeight: number,
  ): PostWithAllData[] {
    return posts
      .map((post) => {
        const q = qualityScores.get(post.id) || 0;
        const pScore = Number(post.personalizationScore || 0);
        return {
          ...post,
          qualityScore: q,
          finalScore: q * qualityWeight + pScore * personalizationWeight,
        };
      })
      .sort((a, b) => b.finalScore - a.finalScore);
  }
}
