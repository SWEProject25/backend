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

  /**
   * Optimized batch calculation for multiple hashtags and categories
   * Reduces complexity from O(N*M) individual queries to O(1) aggregated query
   */
  public async calculateTrendsBatch(
    hashtagIds: number[],
    categories: TrendCategory[],
  ): Promise<{ processed: number; failed: number }> {
    if (hashtagIds.length === 0 || categories.length === 0) {
      return { processed: 0, failed: 0 };
    }

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    let processed = 0;
    let failed = 0;

    try {
      // Group hashtags and fetch all post data in a single query per time period
      const baseWhere = {
        hashtags: { some: { id: { in: hashtagIds } } },
        is_deleted: false,
      };

      // Fetch all posts once grouped by hashtag and time periods
      const [posts1h, posts24h, posts7d] = await Promise.all([
        this.prismaService.post.findMany({
          where: { ...baseWhere, created_at: { gte: oneHourAgo } },
          select: {
            id: true,
            hashtags: { select: { id: true } },
            Interest: { select: { slug: true } },
          },
        }),
        this.prismaService.post.findMany({
          where: { ...baseWhere, created_at: { gte: oneDayAgo } },
          select: {
            id: true,
            hashtags: { select: { id: true } },
            Interest: { select: { slug: true } },
          },
        }),
        this.prismaService.post.findMany({
          where: { ...baseWhere, created_at: { gte: sevenDaysAgo } },
          select: {
            id: true,
            hashtags: { select: { id: true } },
            Interest: { select: { slug: true } },
          },
        }),
      ]);

      // Build aggregated counts for each hashtag-category combination
      const trendsMap = new Map<string, { count1h: number; count24h: number; count7d: number }>();

      const processPostsForPeriod = (posts: any[], periodKey: '1h' | '24h' | '7d') => {
        posts.forEach((post) => {
          const interestSlug = post.Interest?.slug;
          post.hashtags.forEach((hashtag: { id: number }) => {
            categories.forEach((category) => {
              const interestSlugs = CATEGORY_TO_INTERESTS[category];

              // Check if post matches category
              const matchesCategory =
                category === TrendCategory.GENERAL ||
                (interestSlugs.length > 0 && interestSlug && interestSlugs.includes(interestSlug));

              if (matchesCategory) {
                const key = `${hashtag.id}:${category}`;
                if (!trendsMap.has(key)) {
                  trendsMap.set(key, { count1h: 0, count24h: 0, count7d: 0 });
                }
                const counts = trendsMap.get(key)!;
                if (periodKey === '1h') counts.count1h++;
                if (periodKey === '24h') counts.count24h++;
                if (periodKey === '7d') counts.count7d++;
              }
            });
          });
        });
      };

      processPostsForPeriod(posts1h, '1h');
      processPostsForPeriod(posts24h, '24h');
      processPostsForPeriod(posts7d, '7d');

      // Delete old trends for all hashtags and categories in batch
      await this.prismaService.hashtagTrend.deleteMany({
        where: {
          hashtag_id: { in: hashtagIds },
          category: { in: categories },
        },
      });

      // Prepare bulk insert data
      const trendsToCreate = Array.from(trendsMap.entries()).map(([key, counts]) => {
        const [hashtagId, category] = key.split(':');
        const score = counts.count1h * 10 + counts.count24h * 2 + counts.count7d * 0.5;

        return {
          hashtag_id: parseInt(hashtagId),
          category: category,
          post_count_1h: counts.count1h,
          post_count_24h: counts.count24h,
          post_count_7d: counts.count7d,
          trending_score: score,
        };
      });

      // Add zero-score entries for hashtags with no posts
      hashtagIds.forEach((hashtagId) => {
        categories.forEach((category) => {
          const key = `${hashtagId}:${category}`;
          if (!trendsMap.has(key)) {
            trendsToCreate.push({
              hashtag_id: hashtagId,
              category: category,
              post_count_1h: 0,
              post_count_24h: 0,
              post_count_7d: 0,
              trending_score: 0,
            });
          }
        });
      });

      // Bulk insert all trends
      if (trendsToCreate.length > 0) {
        await this.prismaService.hashtagTrend.createMany({
          data: trendsToCreate,
          skipDuplicates: true,
        });
        processed = trendsToCreate.length;
      }

      this.logger.log(
        `Batch calculated ${processed} trends for ${hashtagIds.length} hashtags across ${categories.length} categories`,
      );

      return { processed, failed };
    } catch (error) {
      this.logger.error('Error in batch trend calculation:', error);
      failed = hashtagIds.length * categories.length;
      return { processed, failed };
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

    // Fetch pre-calculated trends from the last hour
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
      // Trigger background recalculation for this category
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
