import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { RedisQueues, Services } from 'src/utils/constants';
import { PostService } from './post.service';
import { extractHashtags } from 'src/utils/extractHashtags';
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

      if (interestSlugs.length > 0) {
        whereClause.Interest = {
          slug: { in: interestSlugs },
        };
      }

      const [count1h, count24h, count7d] = await Promise.all([
        this.prismaService.post.count({
          where: {
            ...whereClause,
            created_at: { gte: oneHourAgo },
          },
        }),
        this.prismaService.post.count({
          where: {
            ...whereClause,
            created_at: { gte: oneDayAgo },
          },
        }),
        this.prismaService.post.count({
          where: {
            ...whereClause,
            created_at: { gte: sevenDaysAgo },
          },
        }),
      ]);
      const score = count1h * 10 + count24h * 2 + count7d * 0.5;

      await this.prismaService.hashtagTrend.create({
        data: {
          hashtag_id: hashtagId,
          post_count_1h: count1h,
          post_count_24h: count24h,
          post_count_7d: count7d,
          trending_score: score,
        },
      });

      // Invalidate all trending caches when new trend is calculated
      await this.redisService.delPattern(`${HASHTAG_TRENDS_TOKEN_PREFIX}*`);

      this.logger.debug(
        `Calculated trend for hashtag ${hashtagId}: score=${score} (1h: ${count1h}, 24h: ${count24h}, 7d: ${count7d})`,
      );

      return score;
    } catch (error) {
      this.logger.error(`Error calculating trend for hashtag ${hashtagId}:`, error);
      throw error;
    }
  }

  public async getTrending(limit: number = 10, category: TrendCategory = TrendCategory.GENERAL) {
    const cacheKey = `${HASHTAG_TRENDS_TOKEN_PREFIX}${category}:${limit}`;
    const cached = await this.redisService.getJSON<any[]>(cacheKey);
    if (cached && cached.length > 0) {
      this.logger.debug(
        `Returning ${cached.length} cached trending hashtags for category ${category}`,
      );
      return cached;
    }

    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const interestSlugs = CATEGORY_TO_INTERESTS[category];
    const trends = await this.prismaService.hashtagTrend.findMany({
      where: {
        calculated_at: { gte: fifteenMinutesAgo },
        trending_score: { gt: 0 },
        ...(interestSlugs.length > 0 && {
          hashtag: {
            posts: {
              some: {
                Interest: {
                  slug: { in: interestSlugs },
                },
                is_deleted: false,
              },
            },
          },
        }),
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
      // background recalculate job
      this.recalculateTrends().catch((err) =>
        this.logger.error('Background recalculation failed:', err),
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
        { hashtagIds: activeHashtags.map((h) => h.id) },
        {
          removeOnComplete: true,
          removeOnFail: false,
          attempts: 2,
        },
      );
    }

    return activeHashtags.length;
  }

  // async reindexAllPostHashtags(): Promise<string> {
  //   const posts = await this.prismaService.post.findMany({
  //     where: { is_deleted: false },
  //     select: { id: true, content: true },
  //   });
  //   let processedCount = 0;
  //   let errorCount = 0;

  //   for (const post of posts) {
  //     try {
  //       const tags = extractHashtags(post.content);

  //       if (tags.length === 0) {
  //         // clear relations
  //         await this.prismaService.post.update({
  //           where: { id: post.id },
  //           data: { hashtags: { set: [] } },
  //         });
  //       } else {
  //         const hashtagIds: number[] = [];
  //         for (const tag of tags) {
  //           const hashtag = await this.prismaService.hashtag.upsert({
  //             where: { tag },
  //             update: {},
  //             create: { tag },
  //           });
  //           hashtagIds.push(hashtag.id);
  //         }

  //         await this.prismaService.post.update({
  //           where: { id: post.id },
  //           data: {
  //             hashtags: {
  //               set: hashtagIds.map((id) => ({ id })),
  //             },
  //           },
  //         });
  //       }
  //       processedCount++;
  //     } catch (error) {
  //       errorCount++;
  //     }
  //   }
  //   const message = `Reindexing complete: ${processedCount} posts processed, ${errorCount} errors`;
  //   return message;
  // }
}
