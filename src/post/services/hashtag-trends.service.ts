import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { Services } from 'src/utils/constants';
import { TrendCategory, CATEGORY_TO_INTERESTS } from '../enums/trend-category.enum';
import { RedisTrendingService } from './redis-trending.service';
import { PersonalizedTrendsService } from './personalized-trends.service';
import { OnEvent } from '@nestjs/event-emitter';

const HASHTAG_TRENDS_TOKEN_PREFIX = 'hashtags:trending:';
export interface PostCreatedEvent {
  postId: number;
  userId: number;
  hashtagIds: number[];
  interestSlug?: string;
  timestamp: number;
}

@Injectable()
export class HashtagTrendService {
  private readonly logger = new Logger(HashtagTrendService.name);
  private readonly CACHE_TTL = 300; // 5 minutes

  private readonly metadataCache = new Map<
    string,
    { tag: string; hashtagId: number; timestamp: number }
  >();
  private readonly MEMORY_CACHE_TTL = 60000; // 1 minute
  private readonly MAX_MEMORY_CACHE_SIZE = 1000;

  private redisHealthy = true;
  private failureCount = 0;
  private readonly MAX_FAILURES = 3;
  private readonly CIRCUIT_RESET_TIME = 30000;

  constructor(
    @Inject(Services.PRISMA)
    private readonly prismaService: PrismaService,
    @Inject(Services.REDIS)
    private readonly redisService: RedisService,
    @Inject(Services.REDIS_TRENDING)
    private readonly redisTrendingService: RedisTrendingService,
    @Inject(Services.PERSONALIZED_TRENDS)
    private readonly personalizedTrendsService: PersonalizedTrendsService,
  ) { }

  public async trackPostHashtags(
    postId: number,
    hashtagIds: number[],
    categories: TrendCategory[],
    timestamp?: number,
  ): Promise<void> {
    if (hashtagIds.length === 0) return;

    try {
      const categoriesToTrack = categories.filter((cat) => cat !== TrendCategory.PERSONALIZED);

      await Promise.all(
        categoriesToTrack.map(async (category) => {
          await this.redisTrendingService.trackPostHashtags(
            postId,
            hashtagIds,
            category,
            timestamp,
          );
        }),
      );

      this.logger.debug(
        `Tracked ${hashtagIds.length} hashtags for post ${postId} across ${categoriesToTrack.length} categories`,
      );
    } catch (error) {
      this.logger.error('Failed to track post hashtags:', error);
      throw error;
    }
  }

  public async syncTrendToDB(
    hashtagId: number,
    category: TrendCategory = TrendCategory.GENERAL,
  ): Promise<number> {
    try {
      const counts = await this.redisTrendingService.getHashtagCounts(hashtagId, category);

      const score = counts.count1h * 10 + counts.count24h * 2 + counts.count7d * 0.5;
      const now = new Date();

      // Use a try-create-catch-update pattern to handle race conditions robustly
      // and avoid potential Prisma type issues with nulls in upsert compound keys.
      try {
        await this.prismaService.hashtagTrend.create({
          data: {
            hashtag_id: hashtagId,
            category,
            user_id: null, // GENERAL trends have no user_id
            post_count_1h: counts.count1h,
            post_count_24h: counts.count24h,
            post_count_7d: counts.count7d,
            trending_score: score,
            calculated_at: now,
          },
        });
      } catch (error) {
        if (error.code === 'P2002') {
          // Unique constraint failed, meaning the trend exists. Update it.
          // We need to find the ID first because we can't easily update by compound key if types are tricky
          // But wait, if we are here, we know it exists.

          await this.prismaService.hashtagTrend.update({
            where: {
              hashtag_id_category_userId: {
                hashtag_id: hashtagId,
                category,
                // We cast to any to bypass the strict typecheck if the generated type is wrong for nulls
                // This is safe because at runtime Prisma handles the null in the query
                user_id: null as any,
              }
            },
            data: {
              post_count_1h: counts.count1h,
              post_count_24h: counts.count24h,
              post_count_7d: counts.count7d,
              trending_score: score,
              calculated_at: now,
            },
          });
        } else {
          throw error;
        }
      }

      this.logger.debug(
        `Synced trend to DB for hashtag ${hashtagId} [${category}]: score=${score}`,
      );

      return score;
    } catch (error) {
      this.logger.error(`Error syncing trend to DB for hashtag ${hashtagId}:`, error);
      throw error;
    }
  }

  public async getTrending(
    limit: number = 10,
    category: TrendCategory = TrendCategory.GENERAL,
    userId?: number,
  ) {
    if (category === TrendCategory.PERSONALIZED) {
      if (!userId) {
        this.logger.warn('PERSONALIZED category requested without userId, using GENERAL');
        return this.getTrendingForCategory(TrendCategory.GENERAL, limit);
      }

      await this.personalizedTrendsService.trackUserActivity(userId).catch((err) => {
        this.logger.warn('Failed to track user activity:', err);
      });

      return this.personalizedTrendsService.getPersonalizedTrending(userId, limit);
    }

    return this.getTrendingForCategory(category, limit);
  }

  private async getTrendingForCategory(category: TrendCategory, limit: number) {
    const cacheKey = `${HASHTAG_TRENDS_TOKEN_PREFIX}${category}:${limit}`;

    const cached = await this.redisService.getJSON<any[]>(cacheKey);
    if (cached && cached.length > 0) {
      this.logger.debug(`Returning cached trending results for ${category}`);
      return cached;
    }

    if (!this.redisHealthy) {
      this.logger.warn('using DB fallback');
      return await this.getTrendingFromDB(limit, category);
    }

    try {
      const trending = await this.redisTrendingService.getTrending(category, limit);

      if (trending.length === 0) {
        this.logger.warn(`No trending data in Redis for ${category}, falling back to DB`);
        const dbResults = await this.getTrendingFromDB(limit, category);
        
        if (dbResults.length > 0) {
          await this.redisService.setJSON(cacheKey, dbResults, this.CACHE_TTL);
          this.logger.debug(`Cached ${dbResults.length} DB results for ${category}`);
        }
        
        return dbResults;
      }

      this.failureCount = 0;
      this.redisHealthy = true;

      const hashtagIds = trending.map((t) => t.hashtagId);

      const metadataResults = new Map<number, { tag: string; hashtagId: number }>();
      const missingFromMemory: number[] = [];

      for (const id of hashtagIds) {
        const memCached = this.getMemoryCachedMetadata(id, category);
        if (memCached) {
          metadataResults.set(id, memCached);
        } else {
          missingFromMemory.push(id);
        }
      }

      if (missingFromMemory.length > 0) {
        const redisMetadata = await this.redisTrendingService.batchGetHashtagMetadata(
          missingFromMemory,
          category,
        );

        for (const [id, metadata] of redisMetadata) {
          metadataResults.set(id, metadata);
          this.setMemoryCachedMetadata(id, metadata.tag, category);
        }
      }

      const missingFromRedis = hashtagIds.filter((id) => !metadataResults.has(id));

      if (missingFromRedis.length > 0) {
        const dbHashtags = await this.prismaService.hashtag.findMany({
          where: { id: { in: missingFromRedis } },
          select: { id: true, tag: true },
        });

        await Promise.all(
          dbHashtags.map(async (h) => {
            const metadata = { tag: h.tag, hashtagId: h.id };
            metadataResults.set(h.id, metadata);
            this.setMemoryCachedMetadata(h.id, h.tag, category);
            await this.redisTrendingService.setHashtagMetadata(h.id, h.tag, category);
          }),
        );
      }

      const countsMap = await this.redisTrendingService.batchGetHashtagCounts(hashtagIds, category);

      const result = trending
        .map((item) => {
          const metadata = metadataResults.get(item.hashtagId);
          const counts = countsMap.get(item.hashtagId);

          if (!metadata || !counts) {
            return null;
          }

          return {
            tag: `#${metadata.tag}`,
            totalPosts: counts.count7d,
            score: item.score,
          };
        })
        .filter((item) => item !== null);

      await this.redisService.setJSON(cacheKey, result, this.CACHE_TTL);

      this.logger.debug(`Found ${result.length} trending hashtags for ${category}`);
      return result;
    } catch (error) {
      this.logger.error(`Error getting trending hashtags for ${category}:`, error);

      this.failureCount++;
      if (this.failureCount >= this.MAX_FAILURES) {
        this.redisHealthy = false;
        this.logger.error('Redis circuit breaker opened due to failures');

        setTimeout(() => {
          this.redisHealthy = true;
          this.failureCount = 0;
          this.logger.log('Redis circuit breaker reset');
        }, this.CIRCUIT_RESET_TIME);
      }

      return await this.getTrendingFromDB(limit, category);
    }
  }

  private getMemoryCachedMetadata(
    hashtagId: number,
    category: TrendCategory,
  ): { tag: string; hashtagId: number } | null {
    const key = `${hashtagId}:${category}`;
    const cached = this.metadataCache.get(key);

    if (cached && Date.now() - cached.timestamp < this.MEMORY_CACHE_TTL) {
      return { tag: cached.tag, hashtagId: cached.hashtagId };
    }

    if (cached) {
      this.metadataCache.delete(key);
    }

    return null;
  }

  private setMemoryCachedMetadata(hashtagId: number, tag: string, category: TrendCategory): void {
    const key = `${hashtagId}:${category}`;

    this.metadataCache.set(key, { tag, hashtagId, timestamp: Date.now() });

    if (this.metadataCache.size > this.MAX_MEMORY_CACHE_SIZE) {
      const firstKey = this.metadataCache.keys().next().value;
      this.metadataCache.delete(firstKey);
    }
  }

  private async getTrendingFromDB(limit: number, category: TrendCategory) {
    try {
      const lastDay = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const whereClause: any = {
        category: category,
        calculated_at: { gte: lastDay },
        trending_score: { gt: 0 },
        user_id: null,
      };

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

      return trends.map((trend) => ({
        tag: `#${trend.hashtag.tag}`,
        totalPosts: trend.post_count_7d,
      }));
    } catch (error) {
      this.logger.error('Failed to get trending from DB:', error);
      return [];
    }
  }

  async syncTrendingToDB(
    category: TrendCategory = TrendCategory.GENERAL,
    limit: number = 200,
  ): Promise<number> {
    if (category === TrendCategory.PERSONALIZED) {
      return 0;
    }

    try {
      const trending = await this.redisTrendingService.getTrending(category, limit);

      if (trending.length === 0) {
        this.logger.warn(`No trending hashtags found in Redis for ${category}`);
        return 0;
      }

      let syncedCount = 0;
      const errors: string[] = [];

      const batchSize = 10;
      for (let i = 0; i < trending.length; i += batchSize) {
        const batch = trending.slice(i, i + batchSize);

        await Promise.all(
          batch.map(async (item) => {
            try {
              await this.syncTrendToDB(item.hashtagId, category);
              syncedCount++;
            } catch (error) {
              const errorMsg = `Failed to sync hashtag ${item.hashtagId}: ${error.message}`;
              errors.push(errorMsg);
              this.logger.warn(errorMsg);
            }
          }),
        );
      }

      if (errors.length > 0) {
        this.logger.warn(
          `Sync completed with ${errors.length} errors out of ${trending.length} hashtags`,
        );
      }

      await this.redisService.delPattern(`${HASHTAG_TRENDS_TOKEN_PREFIX}${category}:*`);
      return syncedCount;
    } catch (error) {
      this.logger.error(`Error syncing trending hashtags to PostgreSQL for ${category}:`, error);
      throw error;
    }
  }

  @OnEvent('post.created', { async: true })
  async handlePostCreated(event: PostCreatedEvent) {
    if (!event.hashtagIds || event.hashtagIds.length === 0) {
      return;
    }

    try {
      const categories = await this.determineCategories(event);
      this.logger.debug(
        `Tracking hashtags for post ${event.postId} in categories: ${categories.join(', ')}`,
      );

      await this.trackPostHashtags(event.postId, event.hashtagIds, categories, event.timestamp);
    } catch (error) {
      this.logger.error(`Failed to handle post.created event for post ${event.postId}:`, error);
    }
  }

  private async determineCategories(event: PostCreatedEvent): Promise<TrendCategory[]> {
    const categories: Set<TrendCategory> = new Set();

    categories.add(TrendCategory.GENERAL);

    if (event.interestSlug) {
      for (const [category, slugs] of Object.entries(CATEGORY_TO_INTERESTS)) {
        if (category === TrendCategory.GENERAL || category === TrendCategory.PERSONALIZED) {
          continue;
        }
        if (slugs.length > 0 && slugs.includes(event.interestSlug)) {
          categories.add(category as TrendCategory);
          this.logger.debug(
            `Post ${event.postId} with interest '${event.interestSlug}' mapped to category '${category}'`
          );
        }
      }
    }

    const result = Array.from(categories);
    this.logger.debug(
      `Post ${event.postId} will be tracked in categories: ${result.join(', ')}`
    );

    return result;
  }
}
