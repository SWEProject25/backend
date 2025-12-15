import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisQueues, Services } from 'src/utils/constants';
import { CreatePostDto } from '../dto/create-post.dto';
import { PostFiltersDto } from '../dto/post-filter.dto';
import { SearchPostsDto } from '../dto/search-posts.dto';
import { SearchByHashtagDto } from '../dto/search-by-hashtag.dto';
import { MediaType, Post, PostType, PostVisibility, Prisma as PrismalSql } from '@prisma/client';
import { StorageService } from 'src/storage/storage.service';
import { AiSummarizationService } from 'src/ai-integration/services/summarization.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SummarizeJob } from 'src/common/interfaces/summarizeJob.interface';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationType } from 'src/notifications/enums/notification.enum';
import { RedisService } from 'src/redis/redis.service';
import { SocketService } from 'src/gateway/socket.service';

import { MLService } from './ml.service';
import { RawPost, RepostedPost, TransformedPost } from '../interfaces/post.interface';
import { HashtagTrendService } from './hashtag-trends.service';
import { extractHashtags } from 'src/utils/extractHashtags';

export const POST_STATS_CACHE_PREFIX = 'post_stats:';
const POST_STATS_CACHE_TTL = 300; // 5 minutes in seconds

export interface ExploreAllInterestsResponse {
  [interestName: string]: FeedPostResponse[];
}

// Add this interface for the raw query result
interface PostWithInterestName extends PostWithAllData {
  interest_id: number;
  interest_name: string;
}

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
    mentions?: Array<{ userId: number; username: string }>;

    // Nested original post data (for reposted quotes - third level only)
    originalPostData?: {
      userId: number;
      username: string;
      verified: boolean;
      name: string;
      avatar: string | null;
      postId: number;
      date: Date;
      likesCount: number;
      retweetsCount: number;
      commentsCount: number;
      isLikedByMe: boolean;
      isFollowedByMe: boolean;
      isRepostedByMe: boolean;
      text: string;
      media: Array<{ url: string; type: MediaType }>;
      mentions?: Array<{ userId: number; username: string }>;
    };
  };

  // Scores data
  personalizationScore: number;
  qualityScore?: number;
  finalScore?: number;
  mentions?: Array<{ userId: number; username: string }>;
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
    mentions?: Array<{ userId: number; username: string }>;
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
      mentions?: Array<{ userId: number; username: string }>;
    };
  };
  mentions?: Array<{ userId: number; username: string }>;
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
    @Inject(Services.AI_SUMMARIZATION)
    private readonly aiSummarizationService: AiSummarizationService,
    @InjectQueue(RedisQueues.postQueue.name)
    private readonly postQueue: Queue,
    @Inject(Services.HASHTAG_TRENDS)
    private readonly hashtagTrendService: HashtagTrendService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(Services.REDIS)
    private readonly redisService: RedisService,
    private readonly socketService: SocketService,
  ) { }

  private getMediaWithType(urls: string[], media?: Express.Multer.File[]) {
    if (urls.length === 0) return [];
    return urls.map((url, index) => ({
      url,
      type: media?.[index]?.mimetype.startsWith('video') ? MediaType.VIDEO : MediaType.IMAGE,
    }));
  }

  private async getPostCounts(postId: number) {
    const grouped = await this.prismaService.post.groupBy({
      by: ['parent_id', 'type'],
      where: {
        parent_id: postId,
        is_deleted: false,
        type: { in: ['REPLY', 'QUOTE'] },
      },
      _count: { _all: true },
    });

    const stats = { replies: 0, quotes: 0 };

    for (const row of grouped) {
      if (row.type === 'REPLY') stats.replies = row._count._all;
      if (row.type === 'QUOTE') stats.quotes = row._count._all;
    }

    return stats;
  }

  async findPosts(options: {
    where: PrismalSql.PostWhereInput;
    userId: number;
    page?: number;
    limit?: number;
  }) {
    const { where, userId, page = 1, limit = 10 } = options;

    const posts = await this.prismaService.post.findMany({
      where,
      include: {
        _count: {
          select: {
            likes: true,
            repostedBy: true,
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
            Muters: {
              where: { muterId: userId },
              select: { muterId: true },
            },
            Blockers: {
              where: { blockerId: userId },
              select: { blockerId: true },
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
        mentions: {
          select: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: {
        created_at: 'desc',
      },
    });
    const counts = await Promise.all(posts.map((post) => this.getPostCounts(post.id)));

    const postsWithCounts = posts.map((post, index) => ({
      ...post,
      quoteCount: counts[index].quotes,
      replyCount: counts[index].replies,
    }));

    return this.transformPost(postsWithCounts);
  }

  private async enrichIfQuoteOrReply(post: TransformedPost[], userId: number) {
    const filteredPosts = post.filter(
      (p) => (p.type === PostType.QUOTE || p.type === PostType.REPLY) && p.parentId !== null,
    );

    if (filteredPosts.length === 0) return post;

    const parentPostIds = filteredPosts.map((p) => p.parentId!);

    const parentPosts = await this.findPosts({
      where: { id: { in: parentPostIds }, is_deleted: false },
      userId: userId,
      page: 1,
      limit: parentPostIds.length,
    });

    const parentPostsMap = new Map<number, TransformedPost>();
    parentPosts.forEach((p) => parentPostsMap.set(p.postId, p));

    return post.map((p) => {
      if ((p.type === PostType.QUOTE || p.type === PostType.REPLY) && p.parentId) {
        p.originalPostData = parentPostsMap.get(p.parentId) || { isDeleted: true };
      }
      return p;
    });
  }

  private async enrichNestedOriginalPosts(
    posts: TransformedPost[],
    currentUserId: number,
  ): Promise<TransformedPost[]> {

    const nestedPostsToEnrich: TransformedPost[] = [];
    const indexMap = new Map<number, number>(); 
    
    for (let i = 0; i < posts.length; i++) {
      const entry = posts[i];
      if (entry.originalPostData && 'postId' in entry.originalPostData) {
        nestedPostsToEnrich.push(entry.originalPostData);
        indexMap.set(entry.originalPostData.postId, i);
      }
    }

    if (nestedPostsToEnrich.length > 0) {
      const nestedEnriched = await this.enrichIfQuoteOrReply(nestedPostsToEnrich, currentUserId);
      
      nestedEnriched.forEach((enrichedPost) => {
        const parentIndex = indexMap.get(enrichedPost.postId);
        if (parentIndex !== undefined) {
          posts[parentIndex].originalPostData = enrichedPost;
        }
      });
    }
    
    return posts;
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
          visibility: PostVisibility.EVERY_ONE,
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
          user_id: postData.userId,
          media_url: m.url,
          type: m.type,
        })),
      });

      await tx.mention.createMany({
        data:
          postData.mentionsIds?.map((id) => ({
            post_id: post.id,
            user_id: id,
          })) ?? [],
      });

      return {
        post: { ...post, mediaUrls: mediaWithType.map((m) => m.url) },
        hashtagIds: hashtagRecords.map((r) => r.id),
        parentPostAuthorId: postData.parentId
          ? (
            await tx.post.findUnique({
              where: { id: postData.parentId },
              select: { user_id: true },
            })
          )?.user_id
          : undefined,
      };
    });
  }

  private async checkUsersExistence(usersIds: number[]) {
    if (usersIds.length === 0) {
      return;
    }
    const uniqueIds = Array.from(new Set(usersIds));

    const existingUsers = await this.prismaService.user.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true },
    });

    if (existingUsers.length !== uniqueIds.length) {
      throw new UnprocessableEntityException('Some user IDs are invalid');
    }
  }

  async checkPostExists(postId: number) {
    const post = await this.prismaService.post.findFirst({
      where: { id: postId, is_deleted: false },
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }
  }

  async createPost(createPostDto: CreatePostDto) {
    let urls: string[] = [];
    try {
      const { content, media, userId } = createPostDto;
      await this.checkUsersExistence(createPostDto.mentionsIds ?? []);

      if (createPostDto.parentId) {
        await this.checkPostExists(createPostDto.parentId);
      }


      urls = await this.storageService.uploadFiles(media);
      const hashtags = extractHashtags(content);

      const mediaWithType = this.getMediaWithType(urls, media);

      const { post, hashtagIds, parentPostAuthorId } = await this.createPostTransaction(
        createPostDto,
        hashtags,
        mediaWithType,
      );

      // Emit notifications after transaction is complete
      // Handle parent post notifications (REPLY/QUOTE)
      if (createPostDto.parentId && parentPostAuthorId && parentPostAuthorId !== userId) {
        if (createPostDto.type === PostType.REPLY) {
          this.eventEmitter.emit('notification.create', {
            type: NotificationType.REPLY,
            recipientId: parentPostAuthorId,
            actorId: userId,
            postId: createPostDto.parentId,
            replyId: post.id,
            threadPostId: createPostDto.parentId,
          });
        } else if (createPostDto.type === PostType.QUOTE) {
          this.eventEmitter.emit('notification.create', {
            type: NotificationType.QUOTE,
            recipientId: parentPostAuthorId,
            actorId: userId,
            quotePostId: post.id,
            postId: createPostDto.parentId,
          });
        }
      }

      // Emit mention notifications for all mentioned users
      if (createPostDto.mentionsIds && createPostDto.mentionsIds.length > 0) {
        createPostDto.mentionsIds.forEach((mentionedUserId) => {
          // Don't notify yourself
          if (mentionedUserId !== userId) {
            this.eventEmitter.emit('notification.create', {
              type: NotificationType.MENTION,
              recipientId: mentionedUserId,
              actorId: userId,
              postId: post.id,
            });
          }
        });
      }

      if (hashtagIds.length > 0) {
        setImmediate(() => {
          this.hashtagTrendService.queueTrendCalculation(hashtagIds).catch((error) => {
            console.log('Failed to queue trends:', error.stack);
          });
        });
      }

      // Update parent post stats cache if this is a reply or quote
      if (createPostDto.parentId && createPostDto.type === 'REPLY') {
        await this.updatePostStatsCache(createPostDto.parentId, 'commentsCount', 1);
      } else if (createPostDto.parentId && createPostDto.type === 'QUOTE') {
        await this.updatePostStatsCache(createPostDto.parentId, 'retweetsCount', 1);
      }

      if (post.content) {
        await this.addToSummarizationQueue({ postContent: post.content, postId: post.id });
        await this.addToInterestQueue({ postContent: post.content, postId: post.id });
      }

      const [fullPost] = await this.findPosts({
        where: { is_deleted: false, id: post.id },
        userId,
        page: 1,
        limit: 1,
      });
      const [enrichedPost] = await this.enrichIfQuoteOrReply([fullPost], userId);

      return enrichedPost;
    } catch (error) {
      // deleting uploaded files in case of any error
      await this.storageService.deleteFiles(urls);
      throw error;
    }
  }

  private async addToSummarizationQueue(job: SummarizeJob) {
    await this.postQueue.add(RedisQueues.postQueue.processes.summarizePostContent, job);
  }

  private async addToInterestQueue(job: SummarizeJob) {
    await this.postQueue.add(RedisQueues.postQueue.processes.interestPostContent, job);
  }

  async summarizePost(postId: number) {
    const post = await this.prismaService.post.findFirst({
      where: { id: postId, is_deleted: false },
    });

    if (!post) throw new NotFoundException('Post not found');

    if (!post.content) {
      throw new UnprocessableEntityException('Post has no content to summarize');
    }

    if (post.summary) {
      return post.summary;
    }

    return this.aiSummarizationService.summarizePost(post.content);
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
        is_deleted: false,
      };

    const posts = await this.prismaService.post.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
    });

    return posts;
  }

  async searchPosts(searchDto: SearchPostsDto, currentUserId: number) {
    const {
      searchQuery,
      userId,
      type,
      page = 1,
      limit = 10,
      similarityThreshold = 0.1,
      before_date,
      order_by = 'relevance',
    } = searchDto;
    const offset = (page - 1) * limit;

    // Build block/mute filters
    const blockMuteFilter = currentUserId
      ? PrismalSql.sql`
      AND NOT EXISTS (
        SELECT 1 FROM blocks WHERE "blockerId" = ${currentUserId} AND "blockedId" = p.user_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM blocks WHERE "blockedId" = ${currentUserId} AND "blockerId" = p.user_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM mutes WHERE "muterId" = ${currentUserId} AND "mutedId" = p.user_id
      )
    `
      : PrismalSql.empty;

    // Build before_date filter
    const beforeDateFilter = before_date
      ? PrismalSql.sql`AND p.created_at < ${before_date}::timestamp`
      : PrismalSql.empty;

    // Build ORDER BY clause
    const orderByClause =
      order_by === 'latest'
        ? PrismalSql.sql`ORDER BY p.created_at DESC`
        : PrismalSql.sql`ORDER BY relevance DESC, p.created_at DESC`;

    const countResult = await this.prismaService.$queryRaw<[{ count: bigint }]>(
      PrismalSql.sql`
        SELECT COUNT(DISTINCT p.id) as count
        FROM posts p
        WHERE 
          p.is_deleted = false
          ${userId ? PrismalSql.sql`AND p.user_id = ${userId}` : PrismalSql.empty}
          ${type ? PrismalSql.sql`AND p.type = ${type}::"PostType"` : PrismalSql.empty}
          AND (
            p.content ILIKE ${'%' + searchQuery + '%'}
            OR similarity(p.content, ${searchQuery}) > ${similarityThreshold}
          )
          ${beforeDateFilter}
          ${blockMuteFilter}
      `,
    );

    const totalItems = Number(countResult[0]?.count || 0);

    const posts = await this.prismaService.$queryRaw<PostWithAllData[]>(
      PrismalSql.sql`
        SELECT 
          p.id,
          p.user_id,
          p.content,
          p.created_at,
          p.type,
          p.visibility,
          p.parent_id,
          p.is_deleted,
          similarity(p.content, ${searchQuery}) as relevance,
          false as "isRepost",
          p.created_at as "effectiveDate",
          NULL::jsonb as "repostedBy",
          
          -- User/Author info
          u.username,
          u.is_verifed as "isVerified",
          COALESCE(pr.name, u.username) as "authorName",
          pr.profile_image_url as "authorProfileImage",
          
          -- Engagement counts
          COUNT(DISTINCT l.user_id)::int as "likeCount",
          COUNT(DISTINCT CASE WHEN reply.id IS NOT NULL THEN reply.id END)::int as "replyCount",
          COUNT(DISTINCT r.user_id)::int as "repostCount",
          
          -- Author stats (dummy values for consistency with feed structure)
          0 as "followersCount",
          0 as "followingCount",
          0 as "postsCount",
          
          -- Content features (dummy values for consistency)
          false as "hasMedia",
          0 as "hashtagCount",
          0 as "mentionCount",
          
          -- User interaction flags
          EXISTS(SELECT 1 FROM "Like" WHERE post_id = p.id AND user_id = ${currentUserId}) as "isLikedByMe",
          EXISTS(SELECT 1 FROM follows WHERE "followerId" = ${currentUserId} AND "followingId" = p.user_id) as "isFollowedByMe",
          EXISTS(SELECT 1 FROM "Repost" WHERE post_id = p.id AND user_id = ${currentUserId}) as "isRepostedByMe",
          
          -- Media URLs (as JSON array)
          COALESCE(
            (SELECT json_agg(json_build_object('url', m.media_url, 'type', m.type))
             FROM "Media" m WHERE m.post_id = p.id),
            '[]'::json
          ) as "mediaUrls",
          
          -- Mentions (as JSON array)
          COALESCE(
            (SELECT json_agg(json_build_object('id', mu.id, 'username', mu.username))
             FROM "Mention" men
             INNER JOIN "User" mu ON mu.id = men.user_id
             WHERE men.post_id = p.id),
            '[]'::json
          ) as "mentions",
          
          -- Original post for quotes only
          CASE 
            WHEN p.parent_id IS NOT NULL AND p.type = 'QUOTE' THEN
              (SELECT json_build_object(
                'postId', op.id,
                'content', op.content,
                'createdAt', op.created_at,
                'likeCount', COALESCE((SELECT COUNT(*)::int FROM "Like" WHERE post_id = op.id), 0),
                'repostCount', COALESCE((SELECT COUNT(*)::int FROM "Repost" WHERE post_id = op.id), 0),
                'replyCount', COALESCE((SELECT COUNT(*)::int FROM posts WHERE parent_id = op.id AND is_deleted = false), 0),
                'isLikedByMe', EXISTS(SELECT 1 FROM "Like" WHERE post_id = op.id AND user_id = ${currentUserId}),
                'isFollowedByMe', EXISTS(SELECT 1 FROM follows WHERE "followerId" = ${currentUserId} AND "followingId" = op.user_id),
                'isRepostedByMe', EXISTS(SELECT 1 FROM "Repost" WHERE post_id = op.id AND user_id = ${currentUserId}),
                'author', json_build_object(
                  'userId', ou.id,
                  'username', ou.username,
                  'isVerified', ou.is_verifed,
                  'name', COALESCE(opr.name, ou.username),
                  'avatar', opr.profile_image_url
                ),
                'media', COALESCE(
                  (SELECT json_agg(json_build_object('url', om.media_url, 'type', om.type))
                   FROM "Media" om WHERE om.post_id = op.id),
                  '[]'::json
                )
              )
              FROM posts op
              LEFT JOIN "User" ou ON ou.id = op.user_id
              LEFT JOIN profiles opr ON opr.user_id = ou.id
              WHERE op.id = p.parent_id AND op.is_deleted = false)
            ELSE NULL
          END as "originalPost",
          
          -- Dummy personalization score (not used but required for interface)
          0::double precision as "personalizationScore"
          
        FROM posts p
        LEFT JOIN "User" u ON u.id = p.user_id
        LEFT JOIN profiles pr ON pr.user_id = u.id
        LEFT JOIN "Like" l ON l.post_id = p.id
        LEFT JOIN "Repost" r ON r.post_id = p.id
        LEFT JOIN posts reply ON reply.parent_id = p.id AND reply.type = 'REPLY' AND reply.is_deleted = false
        WHERE 
          p.is_deleted = false
          ${userId ? PrismalSql.sql`AND p.user_id = ${userId}` : PrismalSql.empty}
          ${type ? PrismalSql.sql`AND p.type = ${type}::"PostType"` : PrismalSql.empty}
          AND (
            p.content ILIKE ${'%' + searchQuery + '%'}
            OR similarity(p.content, ${searchQuery}) > ${similarityThreshold}
          )
          ${beforeDateFilter}
          ${blockMuteFilter}
        GROUP BY p.id, u.id, u.username, u.is_verifed, pr.name, pr.profile_image_url
        ${orderByClause}
        LIMIT ${limit} 
        OFFSET ${offset}
      `,
    );

    const formattedPosts = posts.map((post) => this.transformToFeedResponseWithoutScores(post));

    return {
      posts: formattedPosts,
      totalItems,
      page,
      limit,
    };
  }

  private transformToFeedResponseWithoutScores(
    post: PostWithAllData,
  ): Omit<FeedPostResponse, 'personalizationScore' | 'qualityScore' | 'finalScore'> {
    const isQuote = post.type === PostType.QUOTE && !!post.parent_id;
    const isSimpleRepost = post.isRepost && !isQuote;

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

    // Build originalPostData
    let originalPostData: any = null;

    if (isSimpleRepost) {
      // For simple reposts, originalPostData is the actual post being reposted
      originalPostData = {
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
      };
    } else if (isQuote && post.originalPost) {
      // For quote tweets, originalPostData is the post being quoted
      originalPostData = {
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
      };
    }

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
      text: isSimpleRepost ? '' : post.content || '',
      media: isSimpleRepost ? [] : Array.isArray(post.mediaUrls) ? post.mediaUrls : [],
      isRepost: isSimpleRepost,
      isQuote: isQuote,
      originalPostData,
      mentions: post.mentions,
    };
  }

  async searchPostsByHashtag(searchDto: SearchByHashtagDto, currentUserId: number) {
    const {
      hashtag,
      userId,
      type,
      page = 1,
      limit = 10,
      before_date,
      order_by = 'most_liked',
    } = searchDto;
    const offset = (page - 1) * limit;

    // Normalize hashtag (remove # if present and convert to lowercase)
    const normalizedHashtag = hashtag.startsWith('#')
      ? hashtag.slice(1).toLowerCase()
      : hashtag.toLowerCase();

    // Build block/mute filters
    const blockMuteFilter = currentUserId
      ? PrismalSql.sql`
      AND NOT EXISTS (
        SELECT 1 FROM blocks WHERE "blockerId" = ${currentUserId} AND "blockedId" = p.user_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM blocks WHERE "blockedId" = ${currentUserId} AND "blockerId" = p.user_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM mutes WHERE "muterId" = ${currentUserId} AND "mutedId" = p.user_id
      )
    `
      : PrismalSql.empty;

    // Build before_date filter
    const beforeDateFilter = before_date
      ? PrismalSql.sql`AND p.created_at < ${before_date}::timestamp`
      : PrismalSql.empty;

    // Build ORDER BY clause
    const orderByClause =
      order_by === 'latest'
        ? PrismalSql.sql`ORDER BY p.created_at DESC`
        : PrismalSql.sql`ORDER BY "likeCount" DESC, p.created_at DESC`;

    // Count total posts with this hashtag
    const countResult = await this.prismaService.$queryRaw<[{ count: bigint }]>(
      PrismalSql.sql`
        SELECT COUNT(DISTINCT p.id) as count
        FROM posts p
        INNER JOIN "_PostHashtags" ph ON ph."B" = p.id
        INNER JOIN "Hashtag" h ON h.id = ph."A"
        WHERE 
          p.is_deleted = false
          AND h.tag = ${normalizedHashtag}
          ${userId ? PrismalSql.sql`AND p.user_id = ${userId}` : PrismalSql.empty}
          ${type ? PrismalSql.sql`AND p.type = ${type}::"PostType"` : PrismalSql.empty}
          ${beforeDateFilter}
          ${blockMuteFilter}
      `,
    );

    const totalItems = Number(countResult[0]?.count || 0);

    const posts = await this.prismaService.$queryRaw<PostWithAllData[]>(
      PrismalSql.sql`
        SELECT 
          p.id,
          p.user_id,
          p.content,
          p.created_at,
          p.type,
          p.visibility,
          p.parent_id,
          p.is_deleted,
          false as "isRepost",
          p.created_at as "effectiveDate",
          NULL::jsonb as "repostedBy",
          
          -- User/Author info
          u.username,
          u.is_verifed as "isVerified",
          COALESCE(pr.name, u.username) as "authorName",
          pr.profile_image_url as "authorProfileImage",
          
          -- Engagement counts
          COUNT(DISTINCT l.user_id)::int as "likeCount",
          COUNT(DISTINCT CASE WHEN reply.id IS NOT NULL THEN reply.id END)::int as "replyCount",
          COUNT(DISTINCT r.user_id)::int as "repostCount",
          
          -- Author stats (dummy values for consistency)
          0 as "followersCount",
          0 as "followingCount",
          0 as "postsCount",
          
          -- Content features (dummy values for consistency)
          false as "hasMedia",
          0 as "hashtagCount",
          0 as "mentionCount",
          
          -- User interaction flags
          EXISTS(SELECT 1 FROM "Like" WHERE post_id = p.id AND user_id = ${currentUserId}) as "isLikedByMe",
          EXISTS(SELECT 1 FROM follows WHERE "followerId" = ${currentUserId} AND "followingId" = p.user_id) as "isFollowedByMe",
          EXISTS(SELECT 1 FROM "Repost" WHERE post_id = p.id AND user_id = ${currentUserId}) as "isRepostedByMe",
          
          -- Media URLs (as JSON array)
          COALESCE(
            (SELECT json_agg(json_build_object('url', m.media_url, 'type', m.type))
             FROM "Media" m WHERE m.post_id = p.id),
            '[]'::json
          ) as "mediaUrls",
          
          -- Mentions (as JSON array)
          COALESCE(
            (SELECT json_agg(json_build_object('id', mu.id, 'username', mu.username))
             FROM "Mention" men
             INNER JOIN "User" mu ON mu.id = men.user_id
             WHERE men.post_id = p.id),
            '[]'::json
          ) as "mentions",
          
          -- Original post for quotes only
          CASE 
            WHEN p.parent_id IS NOT NULL AND p.type = 'QUOTE' THEN
              (SELECT json_build_object(
                'postId', op.id,
                'content', op.content,
                'createdAt', op.created_at,
                'likeCount', COALESCE((SELECT COUNT(*)::int FROM "Like" WHERE post_id = op.id), 0),
                'repostCount', COALESCE((SELECT COUNT(*)::int FROM "Repost" WHERE post_id = op.id), 0),
                'replyCount', COALESCE((SELECT COUNT(*)::int FROM posts WHERE parent_id = op.id AND is_deleted = false), 0),
                'isLikedByMe', EXISTS(SELECT 1 FROM "Like" WHERE post_id = op.id AND user_id = ${currentUserId}),
                'isFollowedByMe', EXISTS(SELECT 1 FROM follows WHERE "followerId" = ${currentUserId} AND "followingId" = op.user_id),
                'isRepostedByMe', EXISTS(SELECT 1 FROM "Repost" WHERE post_id = op.id AND user_id = ${currentUserId}),
                'author', json_build_object(
                  'userId', ou.id,
                  'username', ou.username,
                  'isVerified', ou.is_verifed,
                  'name', COALESCE(opr.name, ou.username),
                  'avatar', opr.profile_image_url
                ),
                'media', COALESCE(
                  (SELECT json_agg(json_build_object('url', om.media_url, 'type', om.type))
                   FROM "Media" om WHERE om.post_id = op.id),
                  '[]'::json
                )
              )
              FROM posts op
              LEFT JOIN "User" ou ON ou.id = op.user_id
              LEFT JOIN profiles opr ON opr.user_id = ou.id
              WHERE op.id = p.parent_id AND op.is_deleted = false)
            ELSE NULL
          END as "originalPost",
          
          -- Dummy personalization score (not used but required for interface)
          0::double precision as "personalizationScore"
          
        FROM posts p
        INNER JOIN "_PostHashtags" ph ON ph."B" = p.id
        INNER JOIN "Hashtag" h ON h.id = ph."A"
        LEFT JOIN "User" u ON u.id = p.user_id
        LEFT JOIN profiles pr ON pr.user_id = u.id
        LEFT JOIN "Like" l ON l.post_id = p.id
        LEFT JOIN "Repost" r ON r.post_id = p.id
        LEFT JOIN posts reply ON reply.parent_id = p.id AND reply.type = 'REPLY' AND reply.is_deleted = false
        WHERE 
          p.is_deleted = false
          AND h.tag = ${normalizedHashtag}
          ${userId ? PrismalSql.sql`AND p.user_id = ${userId}` : PrismalSql.empty}
          ${type ? PrismalSql.sql`AND p.type = ${type}::"PostType"` : PrismalSql.empty}
          ${beforeDateFilter}
          ${blockMuteFilter}
        GROUP BY p.id, u.id, u.username, u.is_verifed, pr.name, pr.profile_image_url
        ${orderByClause}
        LIMIT ${limit} 
        OFFSET ${offset}
      `,
    );

    // Transform to feed response format (without scores)
    const formattedPosts = posts.map((post) => this.transformToFeedResponseWithoutScores(post));

    return {
      posts: formattedPosts,
      totalItems,
      page,
      limit,
      hashtag: normalizedHashtag,
    };
  }

  private async getReposts(userId: number, currentUserId: number, page: number, limit: number): Promise<RepostedPost[]> {
    const reposts = await this.prismaService.repost.findMany({
      where: {
        user_id: userId,
        post: {
          is_deleted: false,
        },
      },
      include: {
        user: {
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
              where: { followerId: currentUserId },
              select: { followerId: true },
            },
            Muters: {
              where: { muterId: currentUserId },
              select: { muterId: true },
            },
            Blockers: {
              where: { blockerId: currentUserId },
              select: { blockerId: true },
            },
          },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: {
        created_at: 'desc',
      },
    });

    const originalPostIds = reposts.map((r) => r.post_id);

    const originalPostData = await this.findPosts({
      where: {
        id: { in: originalPostIds },
        is_deleted: false,
      },
      userId: currentUserId,
      page,
      limit: originalPostIds.length,
    });

    const enrichedOriginalParentData = await this.enrichIfQuoteOrReply(
      originalPostData,
      currentUserId,
    );

    const postMap = new Map<number, any>();
    enrichedOriginalParentData.forEach((p) => postMap.set(p.postId, p));

    // 5. Embed original post data into reposts
    return reposts.map((r) => ({
      userId: r.user_id,
      username: r.user.username,
      verified: r.user.is_verified,
      name: r.user.Profile?.name || r.user.username,
      avatar: r.user.Profile?.profile_image_url || null,
      isFollowedByMe: (r.user.Followers && r.user.Followers.length > 0) || false,
      isMutedByMe: (r.user.Muters && r.user.Muters.length > 0) || false,
      isBlockedByMe: (r.user.Blockers && r.user.Blockers.length > 0) || false,
      date: r.created_at,
      originalPostData: postMap.get(r.post_id),
    }));
  }

  async getUserPosts(userId: number, currentUserId: number, page: number, limit: number) {
    // includes reposts, posts, and quotes
    const safetyLimit = page * limit;
    const offset = (page - 1) * limit;

    const [posts, reposts] = await Promise.all([
      this.findPosts({
        where: {
          user_id: userId,
          type: { in: [PostType.POST, PostType.QUOTE] },
          is_deleted: false,
        },
        userId: currentUserId,
        page: 1,
        limit: safetyLimit,
      }),
      this.getReposts(userId, currentUserId, 1, safetyLimit),
    ]);
    const enrichIfQuoteOrReply = await this.enrichIfQuoteOrReply(posts, currentUserId);

    const combined = this.combineAndSort(enrichIfQuoteOrReply, reposts);
    return combined.slice(offset, offset + limit);
  }
  private combineAndSort(posts: TransformedPost[], reposts: RepostedPost[]) {
    const combined = [
      ...posts.map((p) => ({ ...p, isRepost: false })),
      ...reposts.map((r) => ({ ...r, isRepost: true })),
    ];

    return combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  private transformPost(posts: RawPost[]): TransformedPost[] {
    return posts.map((post) => ({
      userId: post.User.id,
      username: post.User.username,
      verified: post.User.is_verified,
      name: post.User.Profile?.name || post.User.username,
      avatar: post.User.Profile?.profile_image_url || null,
      postId: post.id,
      parentId: post.parent_id,
      type: post.type,
      date: post.created_at,
      likesCount: post._count.likes,
      retweetsCount: post._count.repostedBy + post.quoteCount,
      commentsCount: post.replyCount,
      isLikedByMe: post.likes.length > 0,
      isFollowedByMe: (post.User.Followers && post.User.Followers.length > 0) || false,
      isRepostedByMe: post.repostedBy.length > 0,
      isMutedByMe: (post.User.Muters && post.User.Muters.length > 0) || false,
      isBlockedByMe: (post.User.Blockers && post.User.Blockers.length > 0) || false,
      text: post.content,
      media: post.media.map((m) => ({
        url: m.media_url,
        type: m.type,
      })),
      mentions: post.mentions.map((mention) => ({
        userId: mention.user.id,
        username: mention.user.username,
      })),
      isRepost: false,
      isQuote: PostType.QUOTE === post.type,
    }));
  }

  async getUserMedia(userId: number, page: number, limit: number) {
    return await this.prismaService.media.findMany({
      where: {
        user_id: userId,
      },
      orderBy: {
        created_at: 'desc',
      },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async getUserReplies(userId: number, currentUserId: number, page: number, limit: number) {
    const replies = await this.findPosts({
      where: {
        type: PostType.REPLY,
        user_id: userId,
        is_deleted: false,
      },
      userId: currentUserId,
      page,
      limit,
    });

    const enrichedOriginalPostsData = await this.enrichIfQuoteOrReply(replies, currentUserId);
    
    return await this.enrichNestedOriginalPosts(enrichedOriginalPostsData, currentUserId);
  }

  async getRepliesOfPost(postId: number, page: number, limit: number, userId: number) {
    return await this.findPosts({
      where: {
        type: PostType.REPLY,
        parent_id: postId,
        is_deleted: false,
      },
      userId,
      page,
      limit,
    });
  }

  async deletePost(postId: number) {
    const result = await this.prismaService.$transaction(async (tx) => {
      const post = await tx.post.findFirst({
        where: { id: postId, is_deleted: false },
      });

      if (!post) {
        throw new NotFoundException('Post not found');
      }

      await tx.mention.deleteMany({
        where: { post_id: postId },
      });
      await tx.like.deleteMany({
        where: { post_id: postId },
      });
      await tx.repost.deleteMany({
        where: { post_id: postId },
      });

      await tx.post.update({
        where: { id: postId },
        data: { is_deleted: true },
      });

      return { post };
    });

    // Update parent post stats cache if this was a reply or quote
    if (result.post.parent_id && result.post.type === 'REPLY') {
      await this.updatePostStatsCache(result.post.parent_id, 'commentsCount', -1);
    } else if (result.post.parent_id && result.post.type === 'QUOTE') {
      await this.updatePostStatsCache(result.post.parent_id, 'retweetsCount', -1);
    }

    return result;
  }

  async getPostById(postId: number, userId: number) {
    const [post] = await this.findPosts({
      where: { id: postId, is_deleted: false },
      userId,
      page: 1,
      limit: 1,
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const enrichedPost = await this.enrichIfQuoteOrReply([post], userId);
    return await this.enrichNestedOriginalPosts(enrichedPost, userId);
  }

  async getPostStats(postId: number) {
    const cacheKey = `${POST_STATS_CACHE_PREFIX}${postId}`;

    // Try to get stats from cache
    const cachedStats = await this.redisService.get(cacheKey);
    if (cachedStats) {
      await this.redisService.expire(cacheKey, POST_STATS_CACHE_TTL); // Refresh TTL
      return JSON.parse(cachedStats);
    }

    // Check if post exists
    const post = await this.prismaService.post.findFirst({
      where: { id: postId, is_deleted: false },
      select: { id: true },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Fetch stats from database
    const [likesCount, repostsCount, repliesCount, quotesCount] = await Promise.all([
      this.prismaService.like.count({
        where: { post_id: postId },
      }),
      this.prismaService.repost.count({
        where: { post_id: postId },
      }),
      this.prismaService.post.count({
        where: {
          parent_id: postId,
          type: PostType.REPLY,
          is_deleted: false,
        },
      }),
      this.prismaService.post.count({
        where: {
          parent_id: postId,
          type: PostType.QUOTE,
          is_deleted: false,
        },
      }),
    ]);

    const stats = {
      likesCount: likesCount,
      retweetsCount: repostsCount + quotesCount,
      commentsCount: repliesCount,
    };

    // Cache the stats
    await this.redisService.set(cacheKey, JSON.stringify(stats), POST_STATS_CACHE_TTL);

    return stats;
  }

  async updatePostStatsCache(
    postId: number,
    field: 'likesCount' | 'retweetsCount' | 'commentsCount',
    delta: number,
  ): Promise<number> {
    const cacheKey = `${POST_STATS_CACHE_PREFIX}${postId}`;

    // Try to get stats from cache
    let cachedStats = await this.redisService.get(cacheKey);
    let stats: { likesCount: number; retweetsCount: number; commentsCount: number };

    if (!cachedStats) {
      // Cache doesn't exist, fetch from DB and create cache
      const [likesCount, repostsCount, repliesCount] = await Promise.all([
        this.prismaService.like.count({ where: { post_id: postId } }),
        this.prismaService.repost.count({ where: { post_id: postId } }),
        this.prismaService.post.count({ where: { parent_id: postId, is_deleted: false } }),
      ]);

      stats = {
        likesCount,
        retweetsCount: repostsCount,
        commentsCount: repliesCount,
      };
    } else {
      // Update the cached stats
      stats = JSON.parse(cachedStats);
      stats[field] = Math.max(0, (stats[field] || 0) + delta);
    }

    // Cache with TTL
    await this.redisService.set(cacheKey, JSON.stringify(stats), POST_STATS_CACHE_TTL);

    // Emit WebSocket event with the updated count
    const eventName = this.mapFieldToEventName(field);
    const count = stats[field];
    this.socketService.emitPostStatsUpdate(postId, eventName, count);

    return count;
  }

  private mapFieldToEventName(
    field: 'likesCount' | 'retweetsCount' | 'commentsCount',
  ): 'likeUpdate' | 'repostUpdate' | 'commentUpdate' {
    switch (field) {
      case 'likesCount':
        return 'likeUpdate';
      case 'retweetsCount':
        return 'repostUpdate';
      case 'commentsCount':
        return 'commentUpdate';
    }
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

    if (!candidatePosts || candidatePosts.length === 0) {
      return { posts: [] };
    }

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
      ownPost: 20.0, // NEW: Bonus for user's own posts
      following: 15.0,
      directLike: 10.0,
      commonLike: 5.0,
      commonFollow: 3.0,
      wTypePost: 1.0,
      wTypeQuote: 0.8,
      wTypeRepost: 0.5,
    };

    const query = `
WITH user_interests AS (
  SELECT "interest_id"
  FROM "user_interests"
  WHERE "user_id" = ${userId}
),
user_follows AS (
  SELECT "followingId" as following_id
  FROM "follows"
  WHERE "followerId" = ${userId}
),
user_blocks AS (
  SELECT "blockedId" as blocked_id
  FROM "blocks"
  WHERE "blockerId" = ${userId}
),
user_mutes AS (
  SELECT "mutedId" as muted_id
  FROM "mutes"
  WHERE "muterId" = ${userId}
),
liked_authors AS (
  SELECT DISTINCT p."user_id" as author_id
  FROM "Like" l
  JOIN "posts" p ON l."post_id" = p."id"
  WHERE l."user_id" = ${userId}
),
-- Get original posts and quotes (STRICT INTEREST FILTER - only posts matching user's interests)
original_posts AS (
  SELECT 
    p."id",
    p."user_id",
    p."content",
    p."created_at",
    p."type",
    p."visibility",
    p."parent_id",
    p."interest_id",
    p."is_deleted",
    false as "isRepost",
    p."created_at" as "effectiveDate",
    NULL::jsonb as "repostedBy"
  FROM "posts" p
  WHERE p."is_deleted" = false
    AND p."type" IN ('POST', 'QUOTE')
    AND p."created_at" > NOW() - INTERVAL '30 days'
    AND p."interest_id" IS NOT NULL
    AND EXISTS (SELECT 1 FROM user_interests ui WHERE ui."interest_id" = p."interest_id")
    AND NOT EXISTS (SELECT 1 FROM user_blocks ub WHERE ub.blocked_id = p."user_id")
    AND NOT EXISTS (SELECT 1 FROM user_mutes um WHERE um.muted_id = p."user_id")
),
-- Get reposts from Repost table (STRICT INTEREST FILTER - only reposts matching user's interests)
repost_items AS (
  SELECT 
    p."id",
    p."user_id",
    p."content",
    p."created_at",
    p."type",
    p."visibility",
    p."parent_id",
    p."interest_id",
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
    AND p."interest_id" IS NOT NULL
    AND EXISTS (SELECT 1 FROM user_interests ui WHERE ui."interest_id" = p."interest_id")
    AND r."created_at" > NOW() - INTERVAL '30 days'
    AND NOT EXISTS (SELECT 1 FROM user_blocks ub WHERE ub.blocked_id = p."user_id")
    AND NOT EXISTS (SELECT 1 FROM user_mutes um WHERE um.muted_id = p."user_id")
    AND NOT EXISTS (SELECT 1 FROM user_blocks ub WHERE ub.blocked_id = r."user_id")
    AND NOT EXISTS (SELECT 1 FROM user_mutes um WHERE um.muted_id = r."user_id")
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
    ap."interest_id",
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
       FROM "Media" m WHERE m."post_id" = ap."id"),
      '[]'::json
    ) as "mediaUrls",
    
    -- Mentions (as JSON array)
    COALESCE(
      (SELECT json_agg(json_build_object('userId', mu."id"::text, 'username', mu."username"))
       FROM "Mention" men
       INNER JOIN "User" mu ON mu."id" = men."user_id"
       WHERE men."post_id" = ap."id"),
      '[]'::json
    ) as "mentions",
    
-- Original post for quotes only (with nested originalPost for quotes within quotes)
    CASE 
      WHEN ap."parent_id" IS NOT NULL AND ap."type" = 'QUOTE' THEN
        (SELECT json_build_object(
          'postId', op."id",
          'content', op."content",
          'createdAt', op."created_at",
          'likeCount', COALESCE((SELECT COUNT(*)::int FROM "Like" WHERE "post_id" = op."id"), 0),
          'repostCount', (COALESCE((SELECT COUNT(*)::int FROM "Repost" WHERE "post_id" = op."id"), 0) + COALESCE((SELECT COUNT(*)::int FROM "posts" WHERE "parent_id" = op."id" AND "type" = 'QUOTE' AND "is_deleted" = false), 0)),
          'replyCount', COALESCE((SELECT COUNT(*)::int FROM "posts" WHERE "parent_id" = op."id" AND "type" = 'REPLY' AND "is_deleted" = false), 0),
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
             FROM "Media" om WHERE om."post_id" = op."id"),
            '[]'::json
          ),
          'mentions', COALESCE(
            (SELECT json_agg(json_build_object('userId', omu."id"::text, 'userName', omu."username"))
             FROM "Mention" omen
             INNER JOIN "User" omu ON omu."id" = omen."user_id"
             WHERE omen."post_id" = op."id"),
            '[]'::json
          ),
          'originalPost', CASE 
            WHEN op."parent_id" IS NOT NULL AND op."type" = 'QUOTE' THEN
              (SELECT json_build_object(
                'postId', oop."id",
                'content', oop."content",
                'createdAt', oop."created_at",
                'likeCount', COALESCE((SELECT COUNT(*)::int FROM "Like" WHERE "post_id" = oop."id"), 0),
                'repostCount', COALESCE((
                  SELECT COUNT(*)::int FROM (
                    SELECT 1 FROM "Repost" WHERE "post_id" = oop."id"
                    UNION ALL
                    SELECT 1 FROM "posts" WHERE "parent_id" = oop."id" AND "type" = 'QUOTE' AND "is_deleted" = false
                  ) AS reposts_union
                ), 0),
                'replyCount', COALESCE((SELECT COUNT(*)::int FROM "posts" WHERE "parent_id" = oop."id" AND "type" = 'REPLY' AND "is_deleted" = false), 0),
                'isLikedByMe', EXISTS(SELECT 1 FROM "Like" WHERE "post_id" = oop."id" AND "user_id" = ${userId}),
                'isFollowedByMe', EXISTS(SELECT 1 FROM user_follows WHERE following_id = oop."user_id"),
                'isRepostedByMe', EXISTS(SELECT 1 FROM "Repost" WHERE "post_id" = oop."id" AND "user_id" = ${userId}),
                'author', json_build_object(
                  'userId', oou."id",
                  'username', oou."username",
                  'isVerified', oou."is_verifed",
                  'name', COALESCE(oopr."name", oou."username"),
                  'avatar', oopr."profile_image_url"
                ),
                'media', COALESCE(
                  (SELECT json_agg(json_build_object('url', oom."media_url", 'type', oom."type"))
                   FROM "Media" oom WHERE oom."post_id" = oop."id"),
                  '[]'::json
                ),
                'mentions', COALESCE(
                  (SELECT json_agg(json_build_object('userId', oomu."id"::text, 'username', oomu."username"))
                   FROM "Mention" oomen
                   INNER JOIN "User" oomu ON oomu."id" = oomen."user_id"
                   WHERE oomen."post_id" = oop."id"),
                  '[]'::json
                )
              )
              FROM "posts" oop
              LEFT JOIN "User" oou ON oou."id" = oop."user_id"
              LEFT JOIN "profiles" oopr ON oopr."user_id" = oou."id"
              WHERE oop."id" = op."parent_id" AND oop."is_deleted" = false)
            ELSE NULL
          END
        )
        FROM "posts" op
        LEFT JOIN "User" ou ON ou."id" = op."user_id"
        LEFT JOIN "profiles" opr ON opr."user_id" = ou."id"
        WHERE op."id" = ap."parent_id" AND op."is_deleted" = false)
      ELSE NULL
    END as "originalPost",
    
    -- Personalization score (STRICT INTEREST MATCH + OWN POST BONUS + TYPE WEIGHT)
    (
      (
        CASE WHEN ap."user_id" = ${userId} THEN ${personalizationWeights.ownPost} ELSE 0 END +
        CASE WHEN uf.following_id IS NOT NULL THEN ${personalizationWeights.following} ELSE 0 END +
        CASE WHEN la.author_id IS NOT NULL THEN ${personalizationWeights.directLike} ELSE 0 END +
        COALESCE(common_likes."count", 0) * ${personalizationWeights.commonLike} +
        CASE WHEN common_follows."exists" THEN ${personalizationWeights.commonFollow} ELSE 0 END
      ) * 
      -- Type multiplier
      CASE 
        WHEN ap."isRepost" = true THEN ${personalizationWeights.wTypeRepost}
        WHEN ap."type" = 'QUOTE' THEN ${personalizationWeights.wTypeQuote}
        ELSE ${personalizationWeights.wTypePost}
      END
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
      COUNT(DISTINCT CASE WHEN replies."id" IS NOT NULL AND replies."type" = 'REPLY' THEN replies."id" END)::int as "replyCount",
      COUNT(DISTINCT r."user_id")::int as "repostCount"
    FROM "posts" base
    LEFT JOIN "Like" l ON l."post_id" = base."id"
    LEFT JOIN "posts" replies ON replies."parent_id" = base."id" AND replies."is_deleted" = false
    LEFT JOIN "Repost" r ON r."post_id" = base."id"
    LEFT JOIN "posts" quotes ON quotes."parent_id" = base."id" AND quotes."is_deleted" = false
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
    SELECT ap."id" as post_id FROM "Media" WHERE "post_id" = ap."id" LIMIT 1
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

    if (!candidatePosts || candidatePosts.length === 0) {
      return { posts: [] };
    }

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
    const wMentions = 0.1;
    const wFreshness = 0.1;
    const T = 2.0;
    const wTypePost = 1.0;
    const wTypeQuote = 0.8;
    const wTypeRepost = 0.5;

    const candidatePosts = await this.prismaService.$queryRawUnsafe<PostWithAllData[]>(`
    WITH following AS (
      SELECT "followingId" AS id FROM "follows" WHERE "followerId" = ${userId}
    ),
    user_follows AS (
      SELECT "followingId" as following_id
      FROM "follows"
      WHERE "followerId" = ${userId}
    ),
    user_mutes AS (
      SELECT "mutedId" as muted_id
      FROM "mutes"
      WHERE "muterId" = ${userId}
    ),
    user_blocks AS (
      SELECT "blockedId" as blocked_id
      FROM "blocks"
      WHERE "blockerId" = ${userId}
    ),
       -- Get original posts and quotes from followed users AND the user themselves
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
      WHERE p."is_deleted" = FALSE
        AND p."type" IN ('POST', 'QUOTE')
        AND (
          p."user_id" = ${userId}
          OR EXISTS (SELECT 1 FROM following f WHERE f.id = p."user_id")
        )
        AND NOT EXISTS (SELECT 1 FROM user_mutes um WHERE um.muted_id = p."user_id")
        AND NOT EXISTS (SELECT 1 FROM user_blocks ub WHERE ub.blocked_id = p."user_id")
    ),
       -- Get reposts from followed users AND the user themselves
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
      INNER JOIN "posts" p ON r."post_id" = p."id"
      INNER JOIN "User" ru ON r."user_id" = ru."id"
      LEFT JOIN "profiles" rpr ON rpr."user_id" = ru."id"
      WHERE p."is_deleted" = FALSE
        AND p."type" IN ('POST', 'QUOTE')
        AND (
          r."user_id" = ${userId}
          OR EXISTS (SELECT 1 FROM following f WHERE f.id = r."user_id")
        )
        AND NOT EXISTS (SELECT 1 FROM user_mutes um WHERE um.muted_id = p."user_id")
        AND NOT EXISTS (SELECT 1 FROM user_blocks ub WHERE ub.blocked_id = p."user_id")
        AND NOT EXISTS (SELECT 1 FROM user_mutes um WHERE um.muted_id = r."user_id")
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

        -- Engagement counts (using LATERAL join for accuracy)
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
        TRUE as "isFollowedByMe",
        EXISTS(SELECT 1 FROM "Repost" WHERE "post_id" = ap."id" AND "user_id" = ${userId}) as "isRepostedByMe",
        
        -- Media URLs (as JSON array)
        COALESCE(
          (SELECT json_agg(json_build_object('url', med."media_url", 'type', med."type"))
           FROM "Media" med WHERE med."post_id" = ap."id"),
          '[]'::json
        ) as "mediaUrls",
        
        -- Mentions (as JSON array)
        COALESCE(
          (SELECT json_agg(json_build_object('userId', mu."id"::text, 'username', mu."username"))
           FROM "Mention" men
           INNER JOIN "User" mu ON mu."id" = men."user_id"
           WHERE men."post_id" = ap."id"),
          '[]'::json
        ) as "mentions",
        
        -- Original post for quotes only (with nested originalPost for quotes within quotes)
        CASE 
          WHEN ap."parent_id" IS NOT NULL AND ap."type" = 'QUOTE' THEN
            (SELECT json_build_object(
              'postId', op."id",
              'content', op."content",
              'createdAt', op."created_at",
              'likeCount', COALESCE((SELECT COUNT(*)::int FROM "Like" WHERE "post_id" = op."id"), 0),
              'repostCount', (COALESCE((SELECT COUNT(*)::int FROM "Repost" WHERE "post_id" = op."id"), 0) + COALESCE((SELECT COUNT(*)::int FROM "posts" WHERE "parent_id" = op."id" AND "type" = 'QUOTE' AND "is_deleted" = false), 0)),
              'replyCount', COALESCE((SELECT COUNT(*)::int FROM "posts" WHERE "parent_id" = op."id" AND "type" = 'REPLY' AND "is_deleted" = false), 0),
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
                 FROM "Media" om WHERE om."post_id" = op."id"),
                '[]'::json
              ),
              'mentions', COALESCE(
                (SELECT json_agg(json_build_object('userId', omu."id"::text, 'username', omu."username"))
                 FROM "Mention" omen
                 INNER JOIN "User" omu ON omu."id" = omen."user_id"
                 WHERE omen."post_id" = op."id"),
                '[]'::json
              ),
              'originalPost', CASE 
                WHEN op."parent_id" IS NOT NULL AND op."type" = 'QUOTE' THEN
                  (SELECT json_build_object(
                    'postId', oop."id",
                    'content', oop."content",
                    'createdAt', oop."created_at",
                    'likeCount', COALESCE((SELECT COUNT(*)::int FROM "Like" WHERE "post_id" = oop."id"), 0),
                    'repostCount', COALESCE((
                      SELECT COUNT(*)::int FROM (
                        SELECT 1 FROM "Repost" WHERE "post_id" = oop."id"
                        UNION ALL
                        SELECT 1 FROM "posts" WHERE "parent_id" = oop."id" AND "type" = 'QUOTE' AND "is_deleted" = false
                      ) AS reposts_union
                    ), 0),
                    'replyCount', COALESCE((SELECT COUNT(*)::int FROM "posts" WHERE "parent_id" = oop."id" AND "type" = 'REPLY' AND "is_deleted" = false), 0),
                    'isLikedByMe', EXISTS(SELECT 1 FROM "Like" WHERE "post_id" = oop."id" AND "user_id" = ${userId}),
                    'isFollowedByMe', EXISTS(SELECT 1 FROM user_follows WHERE following_id = oop."user_id"),
                    'isRepostedByMe', EXISTS(SELECT 1 FROM "Repost" WHERE "post_id" = oop."id" AND "user_id" = ${userId}),
                    'author', json_build_object(
                      'userId', oou."id",
                      'username', oou."username",
                      'isVerified', oou."is_verifed",
                      'name', COALESCE(oopr."name", oou."username"),
                      'avatar', oopr."profile_image_url"
                    ),
                    'media', COALESCE(
                      (SELECT json_agg(json_build_object('url', oom."media_url", 'type', oom."type"))
                       FROM "Media" oom WHERE oom."post_id" = oop."id"),
                      '[]'::json
                    ),
                    'mentions', COALESCE(
                      (SELECT json_agg(json_build_object('userId', oomu."id"::text, 'username', oomu."username"))
                       FROM "Mention" oomen
                       INNER JOIN "User" oomu ON oomu."id" = oomen."user_id"
                       WHERE oomen."post_id" = oop."id"),
                      '[]'::json
                    )
                  )
                  FROM "posts" oop
                  LEFT JOIN "User" oou ON oou."id" = oop."user_id"
                  LEFT JOIN "profiles" oopr ON oopr."user_id" = oou."id"
                  WHERE oop."id" = op."parent_id" AND oop."is_deleted" = false)
                ELSE NULL
              END
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
      
      -- Engagement metrics (LATERAL join for accurate counts)
      LEFT JOIN LATERAL (
        SELECT 
          COUNT(DISTINCT l."user_id")::int as "likeCount",
          COUNT(DISTINCT CASE WHEN replies."id" IS NOT NULL AND replies."type" = 'REPLY' THEN replies."id" END)::int as "replyCount",
          (COUNT(DISTINCT r."user_id") + COUNT(DISTINCT CASE WHEN quotes."id" IS NOT NULL AND quotes."type" = 'QUOTE' THEN quotes."id" END))::int as "repostCount"
        FROM "posts" base
        LEFT JOIN "Like" l ON l."post_id" = base."id"
        LEFT JOIN "posts" replies ON replies."parent_id" = base."id" AND replies."is_deleted" = false
        LEFT JOIN "Repost" r ON r."post_id" = base."id"
        LEFT JOIN "posts" quotes ON quotes."parent_id" = base."id" AND quotes."is_deleted" = false
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
        SELECT ap."id" as post_id FROM "Media" WHERE "post_id" = ap."id" LIMIT 1
      ) media_check ON true
      
      -- Hashtag count
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int as count FROM "_PostHashtags" WHERE "B" = ap."id"
      ) hashtag_count ON true
      
      -- Mention count
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int as count FROM "Mention" WHERE "post_id" = ap."id"
      ) mention_count ON true
    ),
    scored_posts AS (
      SELECT
        *,
        (
          (
            ${wIsMine} * (CASE WHEN "user_id" = ${userId} THEN 1 ELSE 0 END) +
            ${wIsFollowing} * 1.0 +
            ${wLikes} * LN(1 + "likeCount") +
            ${wReposts} * LN(1 + "repostCount") +
            ${wReplies} * LN(1 + "replyCount") +
            ${wMentions} * LN(1 + "mentionCount") +
            ${wFreshness} * (1.0 / (1.0 + (hours_since / ${T})))
          ) * 
          -- Type multiplier
          CASE 
            WHEN "isRepost" = true THEN ${wTypeRepost}
            WHEN "type" = 'QUOTE' THEN ${wTypeQuote}
            ELSE ${wTypePost}
          END
        )::double precision AS "personalizationScore"
      FROM candidate_posts
    )
    SELECT * FROM scored_posts
    ORDER BY "personalizationScore" DESC, "effectiveDate" DESC
    LIMIT ${limit} OFFSET ${(page - 1) * limit};
  `);
    return candidatePosts;
  }

  private transformToFeedResponse(post: PostWithAllData): FeedPostResponse {
    // Check if this is a repost (simple repost or repost of a quote)
    const isRepost = post.isRepost === true;
    // Check if the ACTUAL post (not repost) is a quote
    const isQuote = !isRepost && post.type === PostType.QUOTE && !!post.parent_id;
    // Check if we're reposting a quote tweet
    const isRepostOfQuote = isRepost && post.type === PostType.QUOTE && !!post.parent_id;

    // For reposts, use reposter's info at top level
    const topLevelUser =
      isRepost && post.repostedBy
        ? post.repostedBy
        : {
          userId: post.user_id,
          username: post.username,
          verified: post.isVerified,
          name: post.authorName || post.username,
          avatar: post.authorProfileImage,
        };

    return {
      // User Information (reposter for reposts, author otherwise)
      userId: topLevelUser.userId,
      username: topLevelUser.username,
      verified: topLevelUser.verified,
      name: topLevelUser.name,
      avatar: topLevelUser.avatar,

      // Tweet Metadata (always present)
      postId: post.id,
      date: isRepost && post.effectiveDate ? post.effectiveDate : post.created_at,
      likesCount: post.likeCount,
      retweetsCount: post.repostCount,
      commentsCount: post.replyCount,

      // User Interaction Flags
      isLikedByMe: post.isLikedByMe,
      isFollowedByMe: post.isFollowedByMe,
      isRepostedByMe: post.isRepostedByMe || false,

      // Tweet Content (empty for reposts, has content for quotes)
      text: isRepost ? '' : post.content || '',
      media: isRepost ? [] : Array.isArray(post.mediaUrls) ? post.mediaUrls : [],

      // Flags
      isRepost: isRepost,
      isQuote: isQuote,

      // Original post data (for reposts and quotes)
      originalPostData:
        isRepost || isQuote
          ? isRepostOfQuote
            ? // Reposting a quote tweet: show the quote with its nested original
            {
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
              mentions: Array.isArray(post.mentions) ? post.mentions : [],
              // The post being quoted by this quote tweet
              originalPostData: post.originalPost
                ? {
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
                  isLikedByMe: post.originalPost.isLikedByMe || false,
                  isFollowedByMe: post.originalPost.isFollowedByMe || false,
                  isRepostedByMe: post.originalPost.isRepostedByMe || false,
                  text: post.originalPost.content || '',
                  media: post.originalPost.media || [],
                  mentions: post.originalPost.mentions || [],
                }
                : undefined,
            }
            : isQuote && post.originalPost
              ? // Direct quote tweet: show the original (no further nesting)
              {
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
                isLikedByMe: post.originalPost.isLikedByMe || false,
                isFollowedByMe: post.originalPost.isFollowedByMe || false,
                isRepostedByMe: post.originalPost.isRepostedByMe || false,
                text: post.originalPost.content || '',
                media: post.originalPost.media || [],
                mentions: post.originalPost.mentions || [],
              }
              : // Simple repost: show the original post
              {
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
                mentions: Array.isArray(post.mentions) ? post.mentions : [],
              }
          : undefined,

      // Scores data
      personalizationScore: post.personalizationScore,
      qualityScore: post.qualityScore,
      finalScore: post.finalScore,
      mentions: Array.isArray(post.mentions) ? post.mentions : [],
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

  async getExploreByInterestsFeed(
    userId: number,
    interestNames: string[],
    options: { page?: number; limit?: number; sortBy?: 'score' | 'latest' } = {},
  ): Promise<{ posts: FeedPostResponse[] }> {
    const { sortBy = 'score' } = options;

    const candidatePosts: PostWithAllData[] = await this.GetPersonalizedExploreByInterestsPosts(
      userId,
      interestNames,
      options,
    );

    if (!candidatePosts || candidatePosts.length === 0) {
      return { posts: [] };
    }

    let rankedPosts: PostWithAllData[];

    if (sortBy === 'latest') {
      // For latest sorting, posts are already sorted by effectiveDate in the query
      // No need for ML scoring or hybrid ranking
      rankedPosts = candidatePosts;
    } else {
      // For score-based sorting, use ML quality scoring + hybrid ranking
      const qualityWeight = 0.3;
      const personalizationWeight = 0.7;

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

      rankedPosts = this.rankPostsHybrid(
        candidatePosts,
        qualityScores,
        qualityWeight,
        personalizationWeight,
      );
    }

    // Transform to frontend response format
    const formattedPosts = rankedPosts.map((post) => this.transformToFeedResponse(post));

    return { posts: formattedPosts };
  }

  private async GetPersonalizedExploreByInterestsPosts(
    userId: number,
    interestNames: string[],
    options: { page?: number; limit?: number; sortBy?: 'score' | 'latest' },
  ): Promise<PostWithAllData[]> {
    const { page = 1, limit = 50, sortBy = 'score' } = options;
    const personalizationWeights = {
      ownPost: 20.0, // NEW: Bonus for user's own posts
      following: 15.0,
      directLike: 10.0,
      commonLike: 5.0,
      commonFollow: 3.0,
      wTypePost: 1.0,
      wTypeQuote: 0.8,
    };

    const orderByClause =
      sortBy === 'latest'
        ? 'ap."effectiveDate" DESC'
        : '"personalizationScore" DESC, ap."effectiveDate" DESC';

    // Escape and format interest names for SQL IN clause
    const escapedInterestNames = interestNames
      .map((name) => `'${name.replace(/'/g, "''")}'`)
      .join(', ');

    const query = `
  WITH target_interests AS (
    SELECT "id" as interest_id
    FROM "interests"
    WHERE "name" IN (${escapedInterestNames})
  ),
  user_follows AS (
    SELECT "followingId" as following_id
    FROM "follows"
    WHERE "followerId" = ${userId}
  ),
  user_blocks AS (
    SELECT "blockedId" as blocked_id
    FROM "blocks"
    WHERE "blockerId" = ${userId}
  ),
  user_mutes AS (
    SELECT "mutedId" as muted_id
    FROM "mutes"
    WHERE "muterId" = ${userId}
  ),
  liked_authors AS (
    SELECT DISTINCT p."user_id" as author_id
    FROM "Like" l
    JOIN "posts" p ON l."post_id" = p."id"
    WHERE l."user_id" = ${userId}
  ),
  -- Get original posts and quotes only (STRICT filter by specified interests, INCLUDE user's own posts)
  all_posts AS (
    SELECT 
      p."id",
      p."user_id",
      p."content",
      p."created_at",
      p."type",
      p."visibility",
      p."parent_id",
      p."interest_id",
      p."is_deleted",
      false as "isRepost",
      p."created_at" as "effectiveDate",
      NULL::jsonb as "repostedBy"
    FROM "posts" p
    WHERE p."is_deleted" = false
      AND p."type" IN ('POST', 'QUOTE')
      AND p."created_at" > NOW() - INTERVAL '30 days'
      AND p."interest_id" IS NOT NULL
      AND EXISTS (SELECT 1 FROM target_interests ti WHERE ti.interest_id = p."interest_id")
      AND NOT EXISTS (SELECT 1 FROM user_blocks ub WHERE ub.blocked_id = p."user_id")
      AND NOT EXISTS (SELECT 1 FROM user_mutes um WHERE um.muted_id = p."user_id")
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
      ap."interest_id",
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
         FROM "Media" m WHERE m."post_id" = ap."id"),
        '[]'::json
      ) as "mediaUrls",
      
      -- Mentions (as JSON array)
      COALESCE(
        (SELECT json_agg(json_build_object('userId', mu."id"::text, 'username', mu."username"))
         FROM "Mention" men
         INNER JOIN "User" mu ON mu."id" = men."user_id"
         WHERE men."post_id" = ap."id"),
        '[]'::json
      ) as "mentions",
      
      -- Original post for quotes only (with nested originalPost for quotes within quotes)
      CASE 
        WHEN ap."parent_id" IS NOT NULL AND ap."type" = 'QUOTE' THEN
          (SELECT json_build_object(
            'postId', op."id",
            'content', op."content",
            'createdAt', op."created_at",
            'likeCount', COALESCE((SELECT COUNT(*)::int FROM "Like" WHERE "post_id" = op."id"), 0),
            'repostCount', COALESCE((
              SELECT COUNT(*)::int FROM (
                SELECT 1 FROM "Repost" WHERE "post_id" = op."id"
                UNION ALL
                SELECT 1 FROM "posts" WHERE "parent_id" = op."id" AND "type" = 'QUOTE' AND "is_deleted" = false
              ) AS reposts_and_quotes
            ), 0),
            'replyCount', COALESCE((SELECT COUNT(*)::int FROM "posts" WHERE "parent_id" = op."id" AND "type" = 'REPLY' AND "is_deleted" = false), 0),
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
               FROM "Media" om WHERE om."post_id" = op."id"),
              '[]'::json
            ),
            'mentions', COALESCE(
              (SELECT json_agg(json_build_object('userId', omu."id"::text, 'username', omu."username"))
               FROM "Mention" omen
               INNER JOIN "User" omu ON omu."id" = omen."user_id"
               WHERE omen."post_id" = op."id"),
              '[]'::json
            ),
            'originalPost', CASE 
              WHEN op."parent_id" IS NOT NULL AND op."type" = 'QUOTE' THEN
                (SELECT json_build_object(
                  'postId', oop."id",
                  'content', oop."content",
                  'createdAt', oop."created_at",
                  'likeCount', COALESCE((SELECT COUNT(*)::int FROM "Like" WHERE "post_id" = oop."id"), 0),
                  'repostCount', COALESCE((
                    SELECT COUNT(*)::int FROM (
                      SELECT 1 FROM "Repost" WHERE "post_id" = oop."id"
                      UNION ALL
                      SELECT 1 FROM "posts" WHERE "parent_id" = oop."id" AND "type" = 'QUOTE' AND "is_deleted" = false
                    ) AS reposts
                  ), 0),
                  'replyCount', COALESCE((SELECT COUNT(*)::int FROM "posts" WHERE "parent_id" = oop."id" AND "type" = 'REPLY' AND "is_deleted" = false), 0),
                  'isLikedByMe', EXISTS(SELECT 1 FROM "Like" WHERE "post_id" = oop."id" AND "user_id" = ${userId}),
                  'isFollowedByMe', EXISTS(SELECT 1 FROM user_follows WHERE following_id = oop."user_id"),
                  'isRepostedByMe', EXISTS(SELECT 1 FROM "Repost" WHERE "post_id" = oop."id" AND "user_id" = ${userId}),
                  'author', json_build_object(
                    'userId', oou."id",
                    'username', oou."username",
                    'isVerified', oou."is_verifed",
                    'name', COALESCE(oopr."name", oou."username"),
                    'avatar', oopr."profile_image_url"
                  ),
                  'media', COALESCE(
                    (SELECT json_agg(json_build_object('url', oom."media_url", 'type', oom."type"))
                     FROM "Media" oom WHERE oom."post_id" = oop."id"),
                    '[]'::json
                  ),
                  'mentions', COALESCE(
                    (SELECT json_agg(json_build_object('userId', oomu."id"::text, 'username', oomu."username"))
                     FROM "Mention" oomen
                     INNER JOIN "User" oomu ON oomu."id" = oomen."user_id"
                     WHERE oomen."post_id" = oop."id"),
                    '[]'::json
                  )
                )
                FROM "posts" oop
                LEFT JOIN "User" oou ON oou."id" = oop."user_id"
                LEFT JOIN "profiles" oopr ON oopr."user_id" = oou."id"
                WHERE oop."id" = op."parent_id" AND oop."is_deleted" = false)
              ELSE NULL
            END
          )
          FROM "posts" op
          LEFT JOIN "User" ou ON ou."id" = op."user_id"
          LEFT JOIN "profiles" opr ON opr."user_id" = ou."id"
          WHERE op."id" = ap."parent_id" AND op."is_deleted" = false)
        ELSE NULL
      END as "originalPost",
      
      -- Personalization score (with OWN POST BONUS + TYPE WEIGHT)
      (
        (
          CASE WHEN ap."user_id" = ${userId} THEN ${personalizationWeights.ownPost} ELSE 0 END +
          CASE WHEN uf.following_id IS NOT NULL THEN ${personalizationWeights.following} ELSE 0 END +
          CASE WHEN la.author_id IS NOT NULL THEN ${personalizationWeights.directLike} ELSE 0 END +
          COALESCE(common_likes."count", 0) * ${personalizationWeights.commonLike} +
          CASE WHEN common_follows."exists" THEN ${personalizationWeights.commonFollow} ELSE 0 END
        ) * 
        -- Type multiplier
        CASE 
          WHEN ap."type" = 'QUOTE' THEN ${personalizationWeights.wTypeQuote}
          ELSE ${personalizationWeights.wTypePost}
        END
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
        COUNT(DISTINCT CASE WHEN replies."id" IS NOT NULL AND replies."type" = 'REPLY' THEN replies."id" END)::int as "replyCount",
        (COUNT(DISTINCT r."user_id") + COUNT(DISTINCT CASE WHEN quotes."id" IS NOT NULL AND quotes."type" = 'QUOTE' THEN quotes."id" END))::int as "repostCount"
      FROM "posts" base
      LEFT JOIN "Like" l ON l."post_id" = base."id"
      LEFT JOIN "posts" replies ON replies."parent_id" = base."id" AND replies."is_deleted" = false
      LEFT JOIN "Repost" r ON r."post_id" = base."id"
      LEFT JOIN "posts" quotes ON quotes."parent_id" = base."id" AND quotes."is_deleted" = false
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
      SELECT ap."id" as post_id FROM "Media" WHERE "post_id" = ap."id" LIMIT 1
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
    
    ORDER BY ${orderByClause}
    LIMIT ${limit} OFFSET ${(page - 1) * limit}
  )
  SELECT * FROM candidate_posts;
`;

    return await this.prismaService.$queryRawUnsafe<PostWithAllData[]>(query);
  }

  async getExploreAllInterestsFeed(
    userId: number,
    options: { postsPerInterest?: number; sortBy?: 'score' | 'latest' } = {},
  ): Promise<ExploreAllInterestsResponse> {
    const { postsPerInterest = 5, sortBy = 'latest' } = options;

    // Get top posts for all interests in a single query (includes interest names)
    const allPosts = await this.GetTopPostsForAllInterests(userId, postsPerInterest, sortBy);

    if (!allPosts || allPosts.length === 0) {
      return {};
    }

    const result: ExploreAllInterestsResponse = {};

    if (sortBy === 'latest') {
      // For 'latest', posts are already sorted by date per interest from the query
      // Group by interest and ensure we respect the limit
      const postsByInterest = new Map<string, PostWithInterestName[]>();

      for (const post of allPosts) {
        const interestName = post.interest_name;
        if (!interestName) continue;

        if (!postsByInterest.has(interestName)) {
          postsByInterest.set(interestName, []);
        }
        postsByInterest.get(interestName)!.push(post);
      }

      // Transform and limit posts per interest (in case query returned more)
      for (const [interestName, posts] of postsByInterest.entries()) {
        result[interestName] = posts
          .slice(0, postsPerInterest)
          .map((post) => this.transformToFeedResponse(post));
      }
    } else {
      // For 'score', apply ML scoring and ranking PER INTEREST
      const qualityWeight = 0.3;
      const personalizationWeight = 0.7;

      // Group posts by interest first
      const postsByInterest = new Map<string, PostWithInterestName[]>();
      for (const post of allPosts) {
        const interestName = post.interest_name;
        if (!interestName) continue;

        if (!postsByInterest.has(interestName)) {
          postsByInterest.set(interestName, []);
        }
        postsByInterest.get(interestName)!.push(post);
      }

      // Process all interests in parallel
      const interestEntries = Array.from(postsByInterest.entries());

      const processedInterests = await Promise.all(
        interestEntries.map(async ([interestName, interestPosts]) => {
          // Prepare posts for ML scoring
          const postsForML = interestPosts.map((p) => ({
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

          // Get quality scores for this interest's posts
          const qualityScores = await this.mlService.getQualityScores(postsForML);

          // Rank posts within this interest only
          const rankedInterestPosts = this.rankPostsHybrid(
            interestPosts,
            qualityScores,
            qualityWeight,
            personalizationWeight,
          ) as PostWithInterestName[];

          // Take top N posts for this interest (may be less than postsPerInterest if interest has fewer posts)
          const topPosts = rankedInterestPosts.slice(0, postsPerInterest);

          return {
            interestName,
            posts: topPosts.map((post) => this.transformToFeedResponse(post)),
          };
        }),
      );

      // Build result object from processed interests
      for (const { interestName, posts } of processedInterests) {
        result[interestName] = posts;
      }
    }

    return result;
  }

  private async GetTopPostsForAllInterests(
    userId: number,
    postsPerInterest: number,
    sortBy: 'score' | 'latest',
  ): Promise<PostWithInterestName[]> {
    const personalizationWeights = {
      ownPost: 20.0,
      following: 15.0,
      directLike: 10.0,
      commonLike: 5.0,
      commonFollow: 3.0,
      wTypePost: 1.0,
      wTypeQuote: 0.8,
    };

    const orderByClause =
      sortBy === 'latest'
        ? '"effectiveDate" DESC'
        : '"personalizationScore" DESC, "effectiveDate" DESC';

    // Single query that gets all active interests and their top posts
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
  user_mutes AS (
    SELECT "mutedId" as muted_id
    FROM "mutes"
    WHERE "muterId" = ${userId}
  ),
  liked_authors AS (
    SELECT DISTINCT p."user_id" as author_id
    FROM "Like" l
    JOIN "posts" p ON l."post_id" = p."id"
    WHERE l."user_id" = ${userId}
  ),
  active_interests AS (
    SELECT "id" as interest_id, "name" as interest_name
    FROM "interests"
    WHERE "is_active" = true
  ),
  -- Get original posts and quotes only for all active interests
  all_posts AS (
    SELECT 
      p."id",
      p."user_id",
      p."content",
      p."created_at",
      p."type",
      p."visibility",
      p."parent_id",
      p."interest_id",
      ai.interest_name,
      p."is_deleted",
      false as "isRepost",
      p."created_at" as "effectiveDate",
      NULL::jsonb as "repostedBy"
    FROM "posts" p
    INNER JOIN active_interests ai ON ai.interest_id = p."interest_id"
    WHERE p."is_deleted" = false
      AND p."type" IN ('POST', 'QUOTE')
      AND p."created_at" > NOW() - INTERVAL '30 days'
      AND p."interest_id" IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM user_blocks ub WHERE ub.blocked_id = p."user_id")
      AND NOT EXISTS (SELECT 1 FROM user_mutes um WHERE um.muted_id = p."user_id")
  ),
  posts_with_scores AS (
    SELECT 
      ap."id",
      ap."user_id",
      ap."content",
      ap."created_at",
      ap."effectiveDate",
      ap."type",
      ap."visibility",
      ap."parent_id",
      ap."interest_id",
      ap."interest_name",
      ap."is_deleted",
      ap."isRepost",
      ap."repostedBy",
      
      -- User/Author info
      u."username",
      u."is_verifed" as "isVerified",
      COALESCE(pr."name", u."username") as "authorName",
      pr."profile_image_url" as "authorProfileImage",
      
      -- Engagement counts
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
         FROM "Media" m WHERE m."post_id" = ap."id"),
        '[]'::json
      ) as "mediaUrls",
      
      -- Mentions (as JSON array)
      COALESCE(
        (SELECT json_agg(json_build_object('userId', mu."id"::text, 'username', mu."username"))
         FROM "Mention" men
         INNER JOIN "User" mu ON mu."id" = men."user_id"
         WHERE men."post_id" = ap."id"),
        '[]'::json
      ) as "mentions",
      
      -- Original post for quotes only (with nested originalPost for quotes within quotes)
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
               FROM "Media" om WHERE om."post_id" = op."id"),
              '[]'::json
            ),
            'mentions', COALESCE(
              (SELECT json_agg(json_build_object('userId', omu."id"::text, 'username', omu."username"))
               FROM "Mention" omen
               INNER JOIN "User" omu ON omu."id" = omen."user_id"
               WHERE omen."post_id" = op."id"),
              '[]'::json
            ),
            'originalPost', CASE 
              WHEN op."parent_id" IS NOT NULL AND op."type" = 'QUOTE' THEN
                (SELECT json_build_object(
                  'postId', oop."id",
                  'content', oop."content",
                  'createdAt', oop."created_at",
                  'likeCount', COALESCE((SELECT COUNT(*)::int FROM "Like" WHERE "post_id" = oop."id"), 0),
                  'repostCount', COALESCE((
                    SELECT COUNT(*)::int FROM (
                      SELECT 1 FROM "Repost" WHERE "post_id" = oop."id"
                      UNION ALL
                      SELECT 1 FROM "posts" WHERE "parent_id" = oop."id" AND "type" = 'QUOTE' AND "is_deleted" = false
                    ) AS reposts
                  ), 0),
                  'replyCount', COALESCE((SELECT COUNT(*)::int FROM "posts" WHERE "parent_id" = oop."id" AND "type" = 'REPLY' AND "is_deleted" = false), 0),
                  'isLikedByMe', EXISTS(SELECT 1 FROM "Like" WHERE "post_id" = oop."id" AND "user_id" = ${userId}),
                  'isFollowedByMe', EXISTS(SELECT 1 FROM user_follows WHERE following_id = oop."user_id"),
                  'isRepostedByMe', EXISTS(SELECT 1 FROM "Repost" WHERE "post_id" = oop."id" AND "user_id" = ${userId}),
                  'author', json_build_object(
                    'userId', oou."id",
                    'username', oou."username",
                    'isVerified', oou."is_verifed",
                    'name', COALESCE(oopr."name", oou."username"),
                    'avatar', oopr."profile_image_url"
                  ),
                  'media', COALESCE(
                    (SELECT json_agg(json_build_object('url', oom."media_url", 'type', oom."type"))
                     FROM "Media" oom WHERE oom."post_id" = oop."id"),
                    '[]'::json
                  ),
                  'mentions', COALESCE(
                    (SELECT json_agg(json_build_object('userId', oomu."id"::text, 'username', oomu."username"))
                     FROM "Mention" oomen
                     INNER JOIN "User" oomu ON oomu."id" = oomen."user_id"
                     WHERE oomen."post_id" = oop."id"),
                    '[]'::json
                  )
                )
                FROM "posts" oop
                LEFT JOIN "User" oou ON oou."id" = oop."user_id"
                LEFT JOIN "profiles" oopr ON oopr."user_id" = oou."id"
                WHERE oop."id" = op."parent_id" AND oop."is_deleted" = false)
              ELSE NULL
            END
          )
          FROM "posts" op
          LEFT JOIN "User" ou ON ou."id" = op."user_id"
          LEFT JOIN "profiles" opr ON opr."user_id" = ou."id"
          WHERE op."id" = ap."parent_id" AND op."is_deleted" = false)
        ELSE NULL
      END as "originalPost",
      
      -- Personalization score (with TYPE WEIGHT)
      (
        (
          CASE WHEN ap."user_id" = ${userId} THEN ${personalizationWeights.ownPost} ELSE 0 END +
          CASE WHEN uf.following_id IS NOT NULL THEN ${personalizationWeights.following} ELSE 0 END +
          CASE WHEN la.author_id IS NOT NULL THEN ${personalizationWeights.directLike} ELSE 0 END +
          COALESCE(common_likes."count", 0) * ${personalizationWeights.commonLike} +
          CASE WHEN common_follows."exists" THEN ${personalizationWeights.commonFollow} ELSE 0 END
        ) * 
        -- Type multiplier
        CASE 
          WHEN ap."type" = 'QUOTE' THEN ${personalizationWeights.wTypeQuote}
          ELSE ${personalizationWeights.wTypePost}
        END
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
        COUNT(DISTINCT CASE WHEN replies."id" IS NOT NULL AND replies."type" = 'REPLY' THEN replies."id" END)::int as "replyCount",
        (COUNT(DISTINCT r."user_id") + COUNT(DISTINCT CASE WHEN quotes."id" IS NOT NULL AND quotes."type" = 'QUOTE' THEN quotes."id" END))::int as "repostCount"
      FROM "posts" base
      LEFT JOIN "Like" l ON l."post_id" = base."id"
      LEFT JOIN "posts" replies ON replies."parent_id" = base."id" AND replies."is_deleted" = false
      LEFT JOIN "Repost" r ON r."post_id" = base."id"
      LEFT JOIN "posts" quotes ON quotes."parent_id" = base."id" AND quotes."is_deleted" = false
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
      SELECT ap."id" as post_id FROM "Media" WHERE "post_id" = ap."id" LIMIT 1
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
  ),
  ranked_posts AS (
    SELECT 
      *,
      ROW_NUMBER() OVER (
        PARTITION BY "interest_id" 
        ORDER BY ${orderByClause}
      ) as row_num
    FROM posts_with_scores
  )
  SELECT 
    "id",
    "user_id",
    "content",
    "created_at",
    "effectiveDate",
    "type",
    "visibility",
    "parent_id",
    "interest_id",
    "interest_name",
    "is_deleted",
    "isRepost",
    "repostedBy",
    "username",
    "isVerified",
    "authorName",
    "authorProfileImage",
    "likeCount",
    "replyCount",
    "repostCount",
    "followersCount",
    "followingCount",
    "postsCount",
    "hasMedia",
    "hashtagCount",
    "mentionCount",
    "isLikedByMe",
    "isFollowedByMe",
    "isRepostedByMe",
    "mediaUrls",
    "mentions",    
    "originalPost",
    "personalizationScore"
  FROM ranked_posts
  WHERE row_num <= ${postsPerInterest}
  ORDER BY "interest_name", row_num;
`;

    return await this.prismaService.$queryRawUnsafe<PostWithInterestName[]>(query);
  }
}
