import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { RedisQueues, Services } from 'src/utils/constants';
import { TrendCategory, CATEGORY_TO_INTERESTS } from '../enums/trend-category.enum';
import { UsersService } from 'src/users/users.service';

const HASHTAG_TRENDS_TOKEN_PREFIX = 'hashtags:trending:';

@Injectable()
export class HashtagTrendService {
  private readonly logger = new Logger(HashtagTrendService.name);
  private readonly CACHE_TTL = 300; // 5 minutes in seconds

  constructor(
    @Inject(Services.PRISMA)
    private readonly prismaService: PrismaService,
    @Inject(Services.REDIS)
    private readonly redisService: RedisService,
    @InjectQueue(RedisQueues.hashTagQueue.name)
    private readonly trendingQueue: Queue,
    @InjectQueue(RedisQueues.bulkHashTagQueue.name)
    private readonly bulkTrendingQueue: Queue,
    @Inject(Services.USERS)
    private readonly usersService: UsersService,
  ) { }

  public async queueTrendCalculation(hashtagIds: number[]) {
    if (hashtagIds.length === 0) return;
    try {
      await this.trendingQueue.add(
        RedisQueues.hashTagQueue.processes.calculateTrends,
        { hashtagIds },
        {
          delay: 5000,
          removeOnComplete: true,
          removeOnFail: false,
          attempts: 3,
        },
      );

      this.logger.debug(`Queued trend calculation for ${hashtagIds.length} hashtags`);
    } catch (error) {
      this.logger.error('Failed to queue trend calculation:', error);
      throw error;
    }
  }

  public async calculateTrend(
    hashtagId: number,
    category: TrendCategory = TrendCategory.GENERAL,
    userId: number | null,
  ): Promise<number> {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      let interestSlugs = CATEGORY_TO_INTERESTS[category];
      if (category === TrendCategory.PERSONALIZED && !userId) {
        return 0;
      }
      if (userId) {
        const userInterests = await this.usersService.getUserInterests(userId);
        interestSlugs = userInterests.map((userInterests) => userInterests.slug);
      }

      const whereClause: any = {
        hashtags: { some: { id: hashtagId } },
        is_deleted: false,
      };

      const [posts1h, posts24h, posts7d] = await Promise.all([
        this.prismaService.post.findMany({
          where: { ...whereClause, created_at: { gte: oneHourAgo } },
          select: {
            id: true,
            Interest: { select: { slug: true } },
          },
        }),
        this.prismaService.post.findMany({
          where: { ...whereClause, created_at: { gte: oneDayAgo } },
          select: {
            id: true,
            Interest: { select: { slug: true } },
          },
        }),
        this.prismaService.post.findMany({
          where: { ...whereClause, created_at: { gte: sevenDaysAgo } },
          select: {
            id: true,
            Interest: { select: { slug: true } },
          },
        }),
      ]);
      const filterByCategory = (posts: any[]) => {
        if (category === TrendCategory.GENERAL || interestSlugs.length === 0) {
          return posts.length;
        }
        return posts.filter(
          (post) => post.Interest?.slug && interestSlugs.includes(post.Interest.slug),
        ).length;
      };

      const count1h = filterByCategory(posts1h);
      const count24h = filterByCategory(posts24h);
      const count7d = filterByCategory(posts7d);

      const score = count1h * 10 + count24h * 2 + count7d * 0.5;

      const isPersonalized = category === TrendCategory.PERSONALIZED;
      const userIdForTrend = isPersonalized ? userId : null;
      const existingTrend = await this.prismaService.hashtagTrend.findFirst({
        where: {
          hashtag_id: hashtagId,
          category,
          user_id: userIdForTrend,
        },
      });

      if (existingTrend) {
        await this.prismaService.hashtagTrend.update({
          where: { id: existingTrend.id },
          data: {
            post_count_1h: count1h,
            post_count_24h: count24h,
            post_count_7d: count7d,
            trending_score: score,
            calculated_at: now,
          },
        });
      } else {
        await this.prismaService.hashtagTrend.create({
          data: {
            hashtag_id: hashtagId,
            category,
            user_id: userIdForTrend,
            post_count_1h: count1h,
            post_count_24h: count24h,
            post_count_7d: count7d,
            trending_score: score,
            calculated_at: now,
          },
        });
      }

      this.logger.debug(
        `Calculated trend for hashtag ${hashtagId} [${category}]: score=${score} (1h: ${count1h}, 24h: ${count24h}, 7d: ${count7d})`,
      );

      return score;
    } catch (error) {
      this.logger.error(`Error calculating trend for hashtag ${hashtagId} [${category}]:`, error);
      throw error;
    }
  }

  public async getTrending(
    limit: number = 10,
    category: TrendCategory = TrendCategory.GENERAL,
    userId?: number,
  ) {
    const cacheKey =
      category === TrendCategory.PERSONALIZED && userId
        ? `${HASHTAG_TRENDS_TOKEN_PREFIX}${category}:${userId}:${limit}`
        : `${HASHTAG_TRENDS_TOKEN_PREFIX}${category}:${limit}`;

    const cached = await this.redisService.getJSON<any[]>(cacheKey);
    if (cached && cached.length > 0) {
      return cached;
    }

    const lastDay = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const whereClause: any = {
      category: category,
      calculated_at: { gte: lastDay },
      trending_score: { gt: 0 },
    };

    // For personalized trends, filter by user_id
    if (category === TrendCategory.PERSONALIZED) {
      if (!userId) {
        return [];
      }
      whereClause.user_id = userId;
    }

    const trends = await this.prismaService.hashtagTrend.findMany({
      where: whereClause,
      include: {
        hashtag: true,
      },
      orderBy: {
        trending_score: 'desc',
      },
      take: limit,
      distinct: ['hashtag_id'],
    });

    if (trends.length === 0) {
      this.recalculateTrends(category, userId).catch((err) =>
        this.logger.error(`Background recalculation failed for ${category}:`, err),
      );
      return [];
    }

    const result = trends.map((trend) => ({
      tag: `#${trend.hashtag.tag}`,
      totalPosts: trend.post_count_7d,
    }));

    await this.redisService.setJSON(cacheKey, result, this.CACHE_TTL);
    return result;
  }

  async recalculateTrends(category: TrendCategory = TrendCategory.GENERAL, userId?: number) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    let interestSlugs = CATEGORY_TO_INTERESTS[category];

    if (category === TrendCategory.PERSONALIZED && userId) {
      const userInterests = await this.usersService.getUserInterests(userId);
      interestSlugs = userInterests.map((userInterests) => userInterests.slug);
    }
    const whereClause: any = {
      posts: {
        some: {
          created_at: { gte: sevenDaysAgo },
          is_deleted: false,
        },
      },
    };

    if (interestSlugs.length > 0) {
      whereClause.posts.some.Interest = {
        slug: { in: interestSlugs },
      };
    }

    const activeHashtags = await this.prismaService.hashtag.findMany({
      where: whereClause,
      select: { id: true },
      take: 200,
    });

    if (activeHashtags.length > 0) {
      await this.bulkTrendingQueue.add(
        RedisQueues.bulkHashTagQueue.processes.recalculateTrends,
        {
          hashtagIds: activeHashtags.map((h) => h.id),
          category: category,
          userId,
        },
        {
          removeOnComplete: true,
          removeOnFail: false,
          attempts: 2,
        },
      );

      // Invalidate cache for this category
      if (category === TrendCategory.PERSONALIZED && userId) {
        await this.redisService.delPattern(`${HASHTAG_TRENDS_TOKEN_PREFIX}${category}:${userId}:*`);
      } else {
        await this.redisService.delPattern(`${HASHTAG_TRENDS_TOKEN_PREFIX}${category}:*`);
      }
    }

    return activeHashtags.length;
  }
}
