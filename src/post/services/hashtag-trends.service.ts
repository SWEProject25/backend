import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { RedisQueues, Services } from 'src/utils/constants';
import { TrendCategory, CATEGORY_TO_INTERESTS } from '../enums/trend-category.enum';

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
  ) {}

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
  ): Promise<number> {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const interestSlugs = CATEGORY_TO_INTERESTS[category];
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

      await this.prismaService.hashtagTrend.upsert({
        where: {
          hashtag_id_category: {
            hashtag_id: hashtagId,
            category: category,
          },
        },
        update: {
          post_count_1h: count1h,
          post_count_24h: count24h,
          post_count_7d: count7d,
          trending_score: score,
          calculated_at: now,
        },
        create: {
          hashtag_id: hashtagId,
          category: category,
          post_count_1h: count1h,
          post_count_24h: count24h,
          post_count_7d: count7d,
          trending_score: score,
          calculated_at: now,
        },
      });

      this.logger.debug(
        `Calculated trend for hashtag ${hashtagId} [${category}]: score=${score} (1h: ${count1h}, 24h: ${count24h}, 7d: ${count7d})`,
      );

      return score;
    } catch (error) {
      this.logger.error(`Error calculating trend for hashtag ${hashtagId} [${category}]:`, error);
      throw error;
    }
  }


  public async getTrending(limit: number = 10, category: TrendCategory = TrendCategory.GENERAL) {
    const cacheKey = `${HASHTAG_TRENDS_TOKEN_PREFIX}${category}:${limit}`;
    const cached = await this.redisService.getJSON<any[]>(cacheKey);
    if (cached && cached.length > 0) {
      return cached;
    }

    const lastHour = new Date(Date.now() - 60 * 60 * 1000);

    const trends = await this.prismaService.hashtagTrend.findMany({
      where: {
        category: category,
        calculated_at: { gte: lastHour },
        trending_score: { gt: 0 },
      },
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
      this.recalculateTrends(category).catch((err) =>
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

  async recalculateTrends(category: TrendCategory = TrendCategory.GENERAL) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const interestSlugs = CATEGORY_TO_INTERESTS[category];
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
      await this.trendingQueue.add(
        RedisQueues.bulkHashTagQueue.processes.recalculateTrends,
        {
          hashtagIds: activeHashtags.map((h) => h.id),
          category: category,
        },
        {
          removeOnComplete: true,
          removeOnFail: false,
          attempts: 2,
        },
      );

      // Invalidate cache for this category
      await this.redisService.delPattern(`${HASHTAG_TRENDS_TOKEN_PREFIX}${category}:*`);
    }

    return activeHashtags.length;
  }
}
