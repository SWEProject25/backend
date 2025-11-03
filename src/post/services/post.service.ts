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
import { RawPost, TransformedPost } from '../interfaces/post.interface';

// This interface now reflects the complex object returned by our query

export interface FeedPostResponse {
  // User Information (of the person who posted/reposted)
  userId: number;
  username: string;
  verified: boolean;
  name: string;
  avatar: string | null;

  // Tweet Metadata (always present)
  postId: number;
  date: Date;
  likesCount: number;
  retweetsCount: number;
  commentsCount: number;

  // User Interaction Flags
  isLikedByMe: boolean;
  isFollowedByMe: boolean;
  isRepostedByMe: boolean;

  // Tweet Content (empty for simple reposts)
  text: string;
  media: Array<{ url: string; type: MediaType }>;

  // Flags
  isRepost: boolean;
  isQuote: boolean;

  // Original post data (for both repost and quote)
  originalPostData?: {
    // User Information
    userId: number;
    username: string;
    verified: boolean;
    name: string;
    avatar: string | null;

    // Tweet Metadata
    postId: number;
    date: Date;
    likesCount: number;
    retweetsCount: number;
    commentsCount: number;

    // User Interaction Flags
    isLikedByMe: boolean;
    isFollowedByMe: boolean;
    isRepostedByMe: boolean;

    // Tweet Content
    text: string;
    media: Array<{ url: string; type: MediaType }>;
  };

  // Scores data
  personalizationScore: number;
  qualityScore?: number;
  finalScore?: number;
}

export interface PostWithAllData extends Post {
  // Personalization & ML scores
  personalizationScore: number;
  qualityScore?: number;
  finalScore?: number;

  // Content features (for ML)
  hasMedia: boolean;
  hashtagCount: number;
  mentionCount: number;

  // Author info
  username: string;
  isVerified: boolean;
  authorName: string | null;
  authorProfileImage: string | null;
  followersCount: number;
  followingCount: number;
  postsCount: number;

  // Engagement counts
  likeCount: number;
  replyCount: number;
  repostCount: number;

  // User interaction flags
  isLikedByMe: boolean;
  isFollowedByMe: boolean;
  isRepostedByMe: boolean;

  // Media
  mediaUrls: Array<{ url: string; type: MediaType }>;

  // Retweet/Repost case (if applicable)
  isRepost: boolean;
  effectiveDate?: Date;
  repostedBy?: {
    userId: number;
    username: string;
    verified: boolean;
    name: string;
    avatar: string | null;
  };

  originalPost?: {
    postId: number;
    content: string;
    createdAt: Date;
    likeCount: number;
    repostCount: number;
    replyCount: number;
    isLikedByMe: boolean;
    isFollowedByMe: boolean;
    isRepostedByMe: boolean;
    author: {
      userId: number;
      username: string;
      isVerified: boolean;
      name: string;
      avatar: string | null;
    };
    media: Array<{ url: string; type: MediaType }>;
  };
}

export interface PostWithAllData extends Post {
  // Personalization & ML scores
  personalizationScore: number;
  qualityScore?: number;
  finalScore?: number;

  // Content features (for ML)
  hasMedia: boolean;
  hashtagCount: number;
  mentionCount: number;

  // Author info
  username: string;
  isVerified: boolean;
  authorName: string | null;
  authorProfileImage: string | null;
  followersCount: number;
  followingCount: number;
  postsCount: number;

  // Engagement counts
  likeCount: number;
  replyCount: number;
  repostCount: number;

  // User interaction flags
  isLikedByMe: boolean;
  isFollowedByMe: boolean;
  isRepostedByMe: boolean;

  // Media
  mediaUrls: Array<{ url: string; type: MediaType }>;

  // Retweet/Repost case (if applicable)
  isRepost: boolean;
  effectiveDate?: Date;
  repostedBy?: {
    userId: number;
    username: string;
    verified: boolean;
    name: string;
    avatar: string | null;
  };

  originalPost?: {
    postId: number;
    content: string;
    createdAt: Date;
    likeCount: number;
    repostCount: number;
    replyCount: number;
    isLikedByMe: boolean;
    isFollowedByMe: boolean;
    isRepostedByMe: boolean;
    author: {
      userId: number;
      username: string;
      isVerified: boolean;
      name: string;
      avatar: string | null;
    };
    media: Array<{ url: string; type: MediaType }>;
  };
}

// Minimal interface for ML service input
export interface MLPostInput {
  postId: number;
  contentLength: number;
  hasMedia: boolean;
  hashtagCount: number;
  mentionCount: number;
  author: {
    authorFollowersCount: number;
    authorFollowingCount: number;
    authorTweetCount: number;
    authorIsVerified: boolean;
  };
}
@Injectable()
export class PostService {
  constructor(
    @Inject(Services.PRISMA)
    private readonly prismaService: PrismaService,
    @Inject(Services.STORAGE)
    private readonly storageService: StorageService,
    private readonly mlService: MLService,
  ) { }

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

  private transformPost(posts: RawPost[]): TransformedPost[] {
    return posts.map((post) => ({
      userId: post.User.id,
      username: post.User.username,
      verified: post.User.is_verified,
      name: post.User.Profile?.name || post.User.username,
      avatar: post.User.Profile?.profile_image_url || null,
      postId: post.id,
      date: post.created_at,
      likesCount: post._count.likes,
      retweetsCount: post._count.repostedBy,
      commentsCount: post._count.Replies,
      isLikedByMe: post.likes.length > 0,
      isFollowedByMe: post.User.Followers && post.User.Followers.length > 0 || false,
      isRepostedByMe: post.repostedBy.length > 0,
      text: post.content,
      media: post.media.map(m => ({
        url: m.media_url,
        type: m.type
      })),
      isRepost: false,
      isQuote: false
    }));
  }

  async getUserReplies(userId: number, page: number, limit: number, visibility?: PostVisibility) {
    return this.getPosts(userId, page, limit, [PostType.REPLY], visibility);
  }

  async getRepliesOfPost(postId: number, page: number, limit: number, userId: number) {
    const replies = await this.prismaService.post.findMany({
      where: {
        type: PostType.REPLY,
        parent_id: postId,
        is_deleted: false,
      },
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
            is_verified: true,
            Profile: {
              select: {
                name: true,
                profile_image_url: true,
              },
            },
            Followers: {
              where: { followerId: userId },
              select: { followerId: true },
            },
          },
        },
        media: {
          select: {
            media_url: true,
            type: true,
          },
        },
        likes: {
          where: { user_id: userId },
          select: { user_id: true },
        },
        repostedBy: {
          where: { user_id: userId },
          select: { user_id: true },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: {
        created_at: 'desc',
      },
    });


    return this.transformPost(replies);
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

  async getPostById(postId: number, userId: number) {
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
        likes: {
          where: { user_id: userId },
          select: { user_id: true },
        },
        repostedBy: {
          where: { user_id: userId },
          select: { user_id: true },
        },
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const { likes, repostedBy, ...postData } = post;

    return {
      ...postData,
      isLikedByMe: likes && likes.length > 0,
      isRepostedByMe: repostedBy && repostedBy.length > 0,
    };
  }

  async getForYouFeed(
    userId: number,
    page: number = 1,
    limit: number = 50,
  ): Promise<{ posts: FeedPostResponse[] }> {
    const qualityWeight = 0.3;
    const personalizationWeight = 0.7;

    const candidatePosts: PostWithAllData[] = await this.GetPersonalizedForYouPosts(
      userId,
      page,
      limit,
    );

    const postsForML = candidatePosts.map((p) => ({
      postId: p.id,
      contentLength: p.content?.length || 0,
      hasMedia: !!p.hasMedia,
      hashtagCount: Number(p.hashtagCount || 0),
      mentionCount: Number(p.mentionCount || 0),
      author: {
        authorId: Number(p.user_id || 0),
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

    // Transform to frontend response format
    const formattedPosts = rankedPosts.map((post) => this.transformToFeedResponse(post));

    return { posts: formattedPosts };
  }

  private async GetPersonalizedForYouPosts(
    userId: number,
    page = 1,
    limit = 50,
  ): Promise<PostWithAllData[]> {
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
    -- Get original posts and quotes (filter by type)
    original_posts AS (
      SELECT 
        p."id",
        p."user_id",
        p."content",
        p."created_at",
        p."type",
        p."visibility",
        p."parent_id",
        p."is_deleted",
        false as "isRepost",
        p."created_at" as "effectiveDate",
        NULL::jsonb as "repostedBy"
      FROM "posts" p
      WHERE p."is_deleted" = false
        AND p."type" IN ('POST', 'QUOTE')
        AND p."created_at" > NOW() - INTERVAL '10 days'
        AND NOT EXISTS (SELECT 1 FROM user_blocks ub WHERE ub.blocked_id = p."user_id")
        AND p."user_id" != ${userId}
    ),
    -- Get reposts from Repost table (only reposts of POST or QUOTE types)
    repost_items AS (
      SELECT 
        p."id",
        p."user_id",
        p."content",
        p."created_at",
        p."type",
        p."visibility",
        p."parent_id",
        p."is_deleted",
        true as "isRepost",
        r."created_at" as "effectiveDate",
        json_build_object(
          'userId', ru."id",
          'username', ru."username",
          'verified', ru."is_verifed",
          'name', COALESCE(rpr."name", ru."username"),
          'avatar', rpr."profile_image_url"
        )::jsonb as "repostedBy"
      FROM "Repost" r
      INNER JOIN "posts" p ON r."post_id" = p."id"
      INNER JOIN "User" ru ON r."user_id" = ru."id"
      LEFT JOIN "profiles" rpr ON rpr."user_id" = ru."id"
      WHERE p."is_deleted" = false
        AND p."type" IN ('POST', 'QUOTE')
        AND r."created_at" > NOW() - INTERVAL '10 days'
        AND NOT EXISTS (SELECT 1 FROM user_blocks ub WHERE ub.blocked_id = p."user_id")
        AND r."user_id" != ${userId}
        AND NOT EXISTS (SELECT 1 FROM user_blocks ub WHERE ub.blocked_id = r."user_id")
    ),
    -- Combine both
    all_posts AS (
      SELECT * FROM original_posts
      UNION ALL
      SELECT * FROM repost_items
    ),
    candidate_posts AS (
      SELECT 
        ap."id",
        ap."user_id",
        ap."content",
        ap."created_at",
        ap."effectiveDate",
        ap."type",
        ap."visibility",
        ap."parent_id",
        ap."is_deleted",
        ap."isRepost",
        ap."repostedBy",
        
        -- User/Author info
        u."username",
        u."is_verifed" as "isVerified",
        COALESCE(pr."name", u."username") as "authorName",
        pr."profile_image_url" as "authorProfileImage",
        
        -- Engagement counts (for original post)
        COALESCE(engagement."likeCount", 0) as "likeCount",
        COALESCE(engagement."replyCount", 0) as "replyCount",
        COALESCE(engagement."repostCount", 0) as "repostCount",
        
        -- Author stats
        author_stats."followersCount",
        author_stats."followingCount",
        author_stats."postsCount",
        
        -- Content features
        CASE WHEN media_check."post_id" IS NOT NULL THEN true ELSE false END as "hasMedia",
        COALESCE(hashtag_count."count", 0) as "hashtagCount",
        COALESCE(mention_count."count", 0) as "mentionCount",
        
        -- User interaction flags
        EXISTS(SELECT 1 FROM "Like" WHERE "post_id" = ap."id" AND "user_id" = ${userId}) as "isLikedByMe",
        EXISTS(SELECT 1 FROM user_follows uf WHERE uf.following_id = ap."user_id") as "isFollowedByMe",
        EXISTS(SELECT 1 FROM "Repost" WHERE "post_id" = ap."id" AND "user_id" = ${userId}) as "isRepostedByMe",
        
        -- Media URLs (as JSON array)
        COALESCE(
          (SELECT json_agg(json_build_object('url', m."media_url", 'type', m."type"))
           FROM "media" m WHERE m."post_id" = ap."id"),
          '[]'::json
        ) as "mediaUrls",
        
        -- Original post for quotes only
        CASE 
          WHEN ap."parent_id" IS NOT NULL AND ap."type" = 'QUOTE' THEN
            (SELECT json_build_object(
              'postId', op."id",
              'content', op."content",
              'createdAt', op."created_at",
              'likeCount', COALESCE((SELECT COUNT(*)::int FROM "Like" WHERE "post_id" = op."id"), 0),
              'repostCount', COALESCE((SELECT COUNT(*)::int FROM "Repost" WHERE "post_id" = op."id"), 0),
              'replyCount', COALESCE((SELECT COUNT(*)::int FROM "posts" WHERE "parent_id" = op."id" AND "is_deleted" = false), 0),
              'isLikedByMe', EXISTS(SELECT 1 FROM "Like" WHERE "post_id" = op."id" AND "user_id" = ${userId}),
              'isFollowedByMe', EXISTS(SELECT 1 FROM user_follows WHERE following_id = op."user_id"),
              'isRepostedByMe', EXISTS(SELECT 1 FROM "Repost" WHERE "post_id" = op."id" AND "user_id" = ${userId}),
              'author', json_build_object(
                'userId', ou."id",
                'username', ou."username",
                'isVerified', ou."is_verifed",
                'name', COALESCE(opr."name", ou."username"),
                'avatar', opr."profile_image_url"
              ),
              'media', COALESCE(
                (SELECT json_agg(json_build_object('url', om."media_url", 'type', om."type"))
                 FROM "media" om WHERE om."post_id" = op."id"),
                '[]'::json
              )
            )
            FROM "posts" op
            LEFT JOIN "User" ou ON ou."id" = op."user_id"
            LEFT JOIN "profiles" opr ON opr."user_id" = ou."id"
            WHERE op."id" = ap."parent_id" AND op."is_deleted" = false)
          ELSE NULL
        END as "originalPost",
        
        -- Personalization score
        (
          CASE WHEN uf.following_id IS NOT NULL THEN ${personalizationWeights.following} ELSE 0 END +
          CASE WHEN la.author_id IS NOT NULL THEN ${personalizationWeights.directLike} ELSE 0 END +
          COALESCE(common_likes."count", 0) * ${personalizationWeights.commonLike} +
          CASE WHEN common_follows."exists" THEN ${personalizationWeights.commonFollow} ELSE 0 END
        )::double precision as "personalizationScore"
        
      FROM all_posts ap
      INNER JOIN "User" u ON ap."user_id" = u."id"
      LEFT JOIN "profiles" pr ON u."id" = pr."user_id"
      LEFT JOIN user_follows uf ON ap."user_id" = uf.following_id
      LEFT JOIN liked_authors la ON ap."user_id" = la.author_id
      
      -- Engagement metrics
      LEFT JOIN LATERAL (
        SELECT 
          COUNT(DISTINCT l."user_id")::int as "likeCount",
          COUNT(DISTINCT CASE WHEN replies."id" IS NOT NULL THEN replies."id" END)::int as "replyCount",
          COUNT(DISTINCT r."user_id")::int as "repostCount"
        FROM "posts" base
        LEFT JOIN "Like" l ON l."post_id" = base."id"
        LEFT JOIN "posts" replies ON replies."parent_id" = base."id" AND replies."is_deleted" = false
        LEFT JOIN "Repost" r ON r."post_id" = base."id"
        WHERE base."id" = ap."id"
      ) engagement ON true
      
      -- Author stats
      LEFT JOIN LATERAL (
        SELECT 
          (SELECT COUNT(*)::int FROM "follows" WHERE "followingId" = u."id") as "followersCount",
          (SELECT COUNT(*)::int FROM "follows" WHERE "followerId" = u."id") as "followingCount",
          (SELECT COUNT(*)::int FROM "posts" WHERE "user_id" = u."id" AND "is_deleted" = false) as "postsCount"
      ) author_stats ON true
      
      -- Media check
      LEFT JOIN LATERAL (
        SELECT ap."id" as post_id FROM "media" WHERE "post_id" = ap."id" LIMIT 1
      ) media_check ON true
      
      -- Hashtag count
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int as count FROM "_PostHashtags" WHERE "B" = ap."id"
      ) hashtag_count ON true
      
      -- Mention count
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int as count FROM "Mention" WHERE "post_id" = ap."id"
      ) mention_count ON true
      
      -- Common likes
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::float as count
        FROM "Like" l
        INNER JOIN user_follows uf_likes ON l."user_id" = uf_likes.following_id
        WHERE l."post_id" = ap."id"
      ) common_likes ON true
      
      -- Common follows
      LEFT JOIN LATERAL (
        SELECT EXISTS(
          SELECT 1 FROM "follows" f
          INNER JOIN user_follows uf_follows ON f."followerId" = uf_follows.following_id
          WHERE f."followingId" = ap."user_id"
        ) as exists
      ) common_follows ON true
      
      ORDER BY "personalizationScore" DESC, ap."effectiveDate" DESC
      LIMIT ${limit} OFFSET ${(page - 1) * limit}
    )
    SELECT * FROM candidate_posts;
  `;

    return await this.prismaService.$queryRawUnsafe<PostWithAllData[]>(query);
  }

  async getFollowingForFeed(
    userId: number,
    page = 1,
    limit = 50,
  ): Promise<{ posts: FeedPostResponse[] }> {
    const qualityWeight = 0.3;
    const personalizationWeight = 0.7;

    const candidatePosts: PostWithAllData[] = await this.GetPersonalizedFollowingPosts(
      userId,
      page,
      limit,
    );

    const postsForML = candidatePosts.map((p) => ({
      postId: p.id,
      contentLength: p.content?.length || 0,
      hasMedia: !!p.hasMedia,
      hashtagCount: Number(p.hashtagCount || 0),
      mentionCount: Number(p.mentionCount || 0),
      author: {
        authorId: Number(p.user_id || 0),
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

    // Transform to frontend response format
    const formattedPosts = rankedPosts.map((post) => this.transformToFeedResponse(post));

    return { posts: formattedPosts };
  }

  private async GetPersonalizedFollowingPosts(
    userId: number,
    page = 1,
    limit = 50,
  ): Promise<PostWithAllData[]> {
    const wIsFollowing = 1.2;
    const wIsMine = 1.5;
    const wLikes = 0.35;
    const wReposts = 0.35;
    const wReplies = 0.15;
    const wQuotes = 0.2;
    const wMentions = 0.1;
    const wFreshness = 0.1;
    const T = 2.0;

    const candidatePosts = await this.prismaService.$queryRawUnsafe<PostWithAllData[]>(`
    WITH following AS (
      SELECT "followingId" AS id FROM "follows" WHERE "followerId" = ${userId}
    ),
    user_follows AS (
      SELECT "followingId" as following_id
      FROM "follows"
      WHERE "followerId" = ${userId}
    ),
    -- Get original posts and quotes from followed users (filter by type)
    original_posts AS (
      SELECT 
        p."id",
        p."user_id",
        p."content",
        p."type",
        p."parent_id",
        p."visibility",
        p."created_at",
        p."is_deleted",
        false as "isRepost",
        p."created_at" as "effectiveDate",
        NULL::jsonb as "repostedBy"
      FROM "posts" p
      INNER JOIN following f ON p."user_id" = f.id
      WHERE p."is_deleted" = FALSE
        AND p."type" IN ('POST', 'QUOTE')
    ),
    -- Get reposts from followed users (only reposts of POST or QUOTE types)
    repost_items AS (
      SELECT 
        p."id",
        p."user_id",
        p."content",
        p."type",
        p."parent_id",
        p."visibility",
        p."created_at",
        p."is_deleted",
        true as "isRepost",
        r."created_at" as "effectiveDate",
        json_build_object(
          'userId', ru."id",
          'username', ru."username",
          'verified', ru."is_verifed",
          'name', COALESCE(rpr."name", ru."username"),
          'avatar', rpr."profile_image_url"
        )::jsonb as "repostedBy"
      FROM "Repost" r
      INNER JOIN following f ON r."user_id" = f.id
      INNER JOIN "posts" p ON r."post_id" = p."id"
      INNER JOIN "User" ru ON r."user_id" = ru."id"
      LEFT JOIN "profiles" rpr ON rpr."user_id" = ru."id"
      WHERE p."is_deleted" = FALSE
        AND p."type" IN ('POST', 'QUOTE')
    ),
    -- Combine both
    all_posts AS (
      SELECT * FROM original_posts
      UNION ALL
      SELECT * FROM repost_items
    ),
    agg AS (
      SELECT
        ap."id",
        ap."user_id",
        ap."content",
        ap."type",
        ap."parent_id",
        ap."visibility",
        ap."created_at",
        ap."effectiveDate",
        ap."is_deleted",
        ap."isRepost",
        ap."repostedBy",
        
        -- User/Author info
        u."username",
        u."is_verifed" as "isVerified",
        COALESCE(pr."name", u."username") AS "authorName",
        pr."profile_image_url" as "authorProfileImage",

        -- Relationship flags
        (ap."user_id" = ${userId}) AS is_mine,
        TRUE AS is_following,

        -- Engagement counts
        COUNT(DISTINCT l."user_id")::int AS "likeCount",
        COUNT(DISTINCT rp."user_id")::int AS "repostCount",
        COUNT(DISTINCT m."id")::int AS mentions_count,
        COUNT(DISTINCT reply."id") FILTER (WHERE reply."type" = 'REPLY')::int AS "replyCount",
        COUNT(DISTINCT quote."id") FILTER (WHERE quote."type" = 'QUOTE')::int AS quotes_count,

        -- Content features
        CASE WHEN media_check."post_id" IS NOT NULL THEN true ELSE false END as "hasMedia",
        COALESCE(hashtag_count."count", 0) as "hashtagCount",
        COALESCE(mention_count."count", 0) as "mentionCount",

        -- Author stats
        (SELECT COUNT(*)::int FROM "follows" WHERE "followingId" = u."id") as "followersCount",
        (SELECT COUNT(*)::int FROM "follows" WHERE "followerId" = u."id") as "followingCount",
        (SELECT COUNT(*)::int FROM "posts" WHERE "user_id" = u."id" AND "is_deleted" = false) as "postsCount",

        -- User interaction flags
        EXISTS(SELECT 1 FROM "Like" WHERE "post_id" = ap."id" AND "user_id" = ${userId}) as "isLikedByMe",
        TRUE as "isFollowedByMe",
        EXISTS(SELECT 1 FROM "Repost" WHERE "post_id" = ap."id" AND "user_id" = ${userId}) as "isRepostedByMe",
        
        -- Media URLs (as JSON array)
        COALESCE(
          (SELECT json_agg(json_build_object('url', med."media_url", 'type', med."type"))
           FROM "media" med WHERE med."post_id" = ap."id"),
          '[]'::json
        ) as "mediaUrls",
        
        -- Original post for quotes only
        CASE 
          WHEN ap."parent_id" IS NOT NULL AND ap."type" = 'QUOTE' THEN
            (SELECT json_build_object(
              'postId', op."id",
              'content', op."content",
              'createdAt', op."created_at",
              'likeCount', COALESCE((SELECT COUNT(*)::int FROM "Like" WHERE "post_id" = op."id"), 0),
              'repostCount', COALESCE((SELECT COUNT(*)::int FROM "Repost" WHERE "post_id" = op."id"), 0),
              'replyCount', COALESCE((SELECT COUNT(*)::int FROM "posts" WHERE "parent_id" = op."id" AND "is_deleted" = false), 0),
              'isLikedByMe', EXISTS(SELECT 1 FROM "Like" WHERE "post_id" = op."id" AND "user_id" = ${userId}),
              'isFollowedByMe', EXISTS(SELECT 1 FROM user_follows WHERE following_id = op."user_id"),
              'isRepostedByMe', EXISTS(SELECT 1 FROM "Repost" WHERE "post_id" = op."id" AND "user_id" = ${userId}),
              'author', json_build_object(
                'userId', ou."id",
                'username', ou."username",
                'isVerified', ou."is_verifed",
                'name', COALESCE(opr."name", ou."username"),
                'avatar', opr."profile_image_url"
              ),
              'media', COALESCE(
                (SELECT json_agg(json_build_object('url', om."media_url", 'type', om."type"))
                 FROM "media" om WHERE om."post_id" = op."id"),
                '[]'::json
              )
            )
            FROM "posts" op
            LEFT JOIN "User" ou ON ou."id" = op."user_id"
            LEFT JOIN "profiles" opr ON opr."user_id" = ou."id"
            WHERE op."id" = ap."parent_id" AND op."is_deleted" = false)
          ELSE NULL
        END as "originalPost",

        EXTRACT(EPOCH FROM (NOW() - ap."effectiveDate")) / 3600.0 AS hours_since
      FROM all_posts ap
      INNER JOIN "User" u ON u."id" = ap."user_id"
      LEFT JOIN "profiles" pr ON pr."user_id" = u."id"
      LEFT JOIN "Like" l ON l."post_id" = ap."id"
      LEFT JOIN "Repost" rp ON rp."post_id" = ap."id"
      LEFT JOIN "Mention" m ON m."post_id" = ap."id"
      LEFT JOIN "posts" reply ON reply."parent_id" = ap."id"
      LEFT JOIN "posts" quote ON quote."parent_id" = ap."id"
      LEFT JOIN LATERAL (
        SELECT ap."id" as post_id FROM "media" WHERE "post_id" = ap."id" LIMIT 1
      ) media_check ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int as count FROM "_PostHashtags" WHERE "B" = ap."id"
      ) hashtag_count ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int as count FROM "Mention" WHERE "post_id" = ap."id"
      ) mention_count ON true

      GROUP BY ap."id", ap."user_id", ap."content", ap."type", ap."parent_id",
               ap."visibility", ap."created_at", ap."effectiveDate", ap."is_deleted", ap."isRepost", ap."repostedBy",
               u."id", u."username", u."is_verifed", pr."name", pr."profile_image_url",
               media_check."post_id", hashtag_count."count", mention_count."count"
    )
    SELECT
      *,
      (
        ${wIsMine} * (CASE WHEN is_mine THEN 1 ELSE 0 END) +
        ${wIsFollowing} * (CASE WHEN is_following THEN 1 ELSE 0 END) +
        ${wLikes} * LN(1 + "likeCount") +
        ${wReposts} * LN(1 + "repostCount") +
        ${wReplies} * LN(1 + COALESCE("replyCount", 0)) +
        ${wMentions} * LN(1 + COALESCE(mentions_count, 0)) +
        ${wQuotes} * LN(1 + COALESCE(quotes_count, 0)) +
        ${wFreshness} * (1.0 / (1.0 + (hours_since / ${T})))
      )::double precision AS "personalizationScore"
    FROM agg
    ORDER BY "personalizationScore" DESC, "effectiveDate" DESC
    LIMIT ${limit} OFFSET ${(page - 1) * limit};
  `);
    return candidatePosts;
  }

  private transformToFeedResponse(post: PostWithAllData): FeedPostResponse {
    const isQuote = post.type === PostType.QUOTE && !!post.parent_id;
    const isSimpleRepost = post.isRepost && !isQuote;

    // For simple reposts, use reposter's info at top level
    const topLevelUser =
      isSimpleRepost && post.repostedBy
        ? post.repostedBy
        : {
          userId: post.user_id,
          username: post.username,
          verified: post.isVerified,
          name: post.authorName || post.username,
          avatar: post.authorProfileImage,
        };

    return {
      // User Information (reposter for simple reposts, author otherwise)
      userId: topLevelUser.userId,
      username: topLevelUser.username,
      verified: topLevelUser.verified,
      name: topLevelUser.name,
      avatar: topLevelUser.avatar,

      // Tweet Metadata (always present)
      postId: post.id,
      date: isSimpleRepost && post.effectiveDate ? post.effectiveDate : post.created_at,
      likesCount: post.likeCount,
      retweetsCount: post.repostCount,
      commentsCount: post.replyCount,

      // User Interaction Flags
      isLikedByMe: post.isLikedByMe,
      isFollowedByMe: post.isFollowedByMe,
      isRepostedByMe: post.isRepostedByMe || false,

      // Tweet Content (empty for simple reposts, has content for quotes)
      text: isSimpleRepost ? '' : post.content || '',
      media: isSimpleRepost ? [] : Array.isArray(post.mediaUrls) ? post.mediaUrls : [],

      // Flags
      isRepost: isSimpleRepost,
      isQuote: isQuote,

      // Original post data (for both repost and quote)
      originalPostData:
        isSimpleRepost || isQuote
          ? {
            userId: post.user_id,
            username: post.username,
            verified: post.isVerified,
            name: post.authorName || post.username,
            avatar: post.authorProfileImage,
            postId: post.id,
            date: post.created_at,
            likesCount: post.likeCount,
            retweetsCount: post.repostCount,
            commentsCount: post.replyCount,
            isLikedByMe: post.isLikedByMe,
            isFollowedByMe: post.isFollowedByMe,
            isRepostedByMe: post.isRepostedByMe || false,
            text: post.content || '',
            media: Array.isArray(post.mediaUrls) ? post.mediaUrls : [],
            ...(isQuote && post.originalPost
              ? {
                // Override with quoted post data for quotes
                userId: post.originalPost.author.userId,
                username: post.originalPost.author.username,
                verified: post.originalPost.author.isVerified,
                name: post.originalPost.author.name,
                avatar: post.originalPost.author.avatar,
                postId: post.originalPost.postId,
                date: post.originalPost.createdAt,
                likesCount: post.originalPost.likeCount,
                retweetsCount: post.originalPost.repostCount,
                commentsCount: post.originalPost.replyCount,
                isLikedByMe: post.originalPost.isLikedByMe,
                isFollowedByMe: post.originalPost.isFollowedByMe,
                isRepostedByMe: post.originalPost.isRepostedByMe,
                text: post.originalPost.content || '',
                media: post.originalPost.media || [],
              }
              : {}),
          }
          : undefined,

      // Scores data
      personalizationScore: post.personalizationScore,
      qualityScore: post.qualityScore,
      finalScore: post.finalScore,
    };
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
