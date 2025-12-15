import { Inject, Injectable, Logger } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { Services } from 'src/utils/constants';
import { TrendCategory } from '../enums/trend-category.enum';

const HASHTAG_TRENDS_TOKEN_PREFIX = 'trending:hashtag:';
const TRENDS_SCORE_TOKEN_PREFIX = 'trending:scores:';
const TRENDS_METADATA_TOKEN_PREFIX = 'trending:metadata:';
const TRENDS_COUNTS_TOKEN_PREFIX = 'trending:counts:';

interface CachedCounts {
  count1h: number;
  count24h: number;
  count7d: number;
  timestamp: number;
}

@Injectable()
export class RedisTrendingService {
  private readonly logger = new Logger(RedisTrendingService.name);

  private readonly TIME_WINDOWS = {
    ONE_HOUR: 60 * 60,
    TWENTY_FOUR_HOURS: 24 * 60 * 60,
    SEVEN_DAYS: 7 * 24 * 60 * 60,
  };

  private readonly SCORE_WEIGHTS = {
    ONE_HOUR: 10,
    TWENTY_FOUR_HOURS: 2,
    SEVEN_DAYS: 0.5,
  };

  private readonly COUNTS_CACHE_TTL = 300; // 5 minutes

  // Lazy update queue
  private updateQueue = new Map<string, Set<number>>();
  private updateTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    @Inject(Services.REDIS)
    private readonly redisService: RedisService,
  ) { }

  private getHashtagKey(
    hashtagId: number,
    timeWindow: '1h' | '24h' | '7d',
    category: TrendCategory,
  ): string {
    return `${HASHTAG_TRENDS_TOKEN_PREFIX}${hashtagId}:${timeWindow}:${category}`;
  }

  private getScoresKey(category: TrendCategory): string {
    return `${TRENDS_SCORE_TOKEN_PREFIX}${category}`;
  }

  private getMetadataKey(hashtagId: number, category: TrendCategory): string {
    return `${TRENDS_METADATA_TOKEN_PREFIX}${hashtagId}:${category}`;
  }

  private getCountsCacheKey(hashtagId: number, category: TrendCategory): string {
    return `${TRENDS_COUNTS_TOKEN_PREFIX}${hashtagId}:${category}`;
  }

  private getTimeBucket(timestamp: number, window: 'hour' | 'day'): number {
    if (window === 'hour') {
      return Math.floor(timestamp / (60 * 60 * 1000));
    }
    return Math.floor(timestamp / (24 * 60 * 60 * 1000));
  }

  async trackHashtagPost(
    hashtagId: number,
    postId: number,
    category: TrendCategory,
    timestamp: number = Date.now(),
  ): Promise<void> {
    try {
      const hourBucket = this.getTimeBucket(timestamp, 'hour');
      const dayBucket = this.getTimeBucket(timestamp, 'day');

      const key1h = `${this.getHashtagKey(hashtagId, '1h', category)}:${hourBucket}`;
      const key24h = `${this.getHashtagKey(hashtagId, '24h', category)}:${dayBucket}`;
      const key7d = this.getHashtagKey(hashtagId, '7d', category);

      await Promise.all([
        this.redisService.incr(key1h),
        this.redisService.expire(key1h, this.TIME_WINDOWS.ONE_HOUR * 2),
        this.redisService.incr(key24h),
        this.redisService.expire(key24h, this.TIME_WINDOWS.TWENTY_FOUR_HOURS * 2),
        this.redisService.zAdd(key7d, [{ score: timestamp, value: postId.toString() }]),
        this.redisService.expire(key7d, this.TIME_WINDOWS.SEVEN_DAYS + 3600),
      ]);

      await this.scheduleScoreUpdate(hashtagId, category);

      this.logger.debug(`Tracked post ${postId} for hashtag ${hashtagId} [${category}]`);
    } catch (error) {
      this.logger.error(`Failed to track hashtag post ${postId}:`, error);
      throw error;
    }
  }

  private async scheduleScoreUpdate(hashtagId: number, category: TrendCategory): Promise<void> {
    const queueKey = category;

    if (!this.updateQueue.has(queueKey)) {
      this.updateQueue.set(queueKey, new Set());
    }

    this.updateQueue.get(queueKey)!.add(hashtagId);

    if (this.updateTimers.has(queueKey)) {
      clearTimeout(this.updateTimers.get(queueKey)!);
    }

    const timer = setTimeout(() => {
      this.processScoreUpdates(queueKey, category).catch((error) => {
        this.logger.error(`Failed to process score updates for ${queueKey}:`, error);
      });
    }, 5000);

    this.updateTimers.set(queueKey, timer);
  }

  private async processScoreUpdates(queueKey: string, category: TrendCategory): Promise<void> {
    const hashtagIds = this.updateQueue.get(queueKey);
    if (!hashtagIds || hashtagIds.size === 0) return;

    this.logger.debug(`Processing ${hashtagIds.size} score updates for ${queueKey}`);

    await Promise.all(Array.from(hashtagIds).map((id) => this.updateTrendingScore(id, category)));

    this.updateQueue.delete(queueKey);
    this.updateTimers.delete(queueKey);
  }

  async updateTrendingScore(hashtagId: number, category: TrendCategory): Promise<number> {
    try {
      const now = Date.now();
      const currentHourBucket = this.getTimeBucket(now, 'hour');
      const currentDayBucket = this.getTimeBucket(now, 'day');

      const count1h = await this.getCountForWindow(hashtagId, '1h', category, currentHourBucket, 1);

      const count24h = await this.getCountForWindow(
        hashtagId,
        '24h',
        category,
        currentDayBucket,
        1,
      );

      const sevenDaysAgo = now - this.TIME_WINDOWS.SEVEN_DAYS * 1000;
      const count7d = await this.redisService.zCount(
        this.getHashtagKey(hashtagId, '7d', category),
        sevenDaysAgo,
        now,
      );

      const score =
        count1h * this.SCORE_WEIGHTS.ONE_HOUR +
        count24h * this.SCORE_WEIGHTS.TWENTY_FOUR_HOURS +
        count7d * this.SCORE_WEIGHTS.SEVEN_DAYS;

      const scoresKey = this.getScoresKey(category);
      if (score > 0) {
        await this.redisService.zAdd(scoresKey, [{ score, value: hashtagId.toString() }]);
        await this.redisService.zRemRangeByRank(scoresKey, 0, -1001);

        const countsCacheKey = this.getCountsCacheKey(hashtagId, category);
        await this.redisService.setJSON(
          countsCacheKey,
          { count1h, count24h, count7d, timestamp: now } as CachedCounts,
          this.COUNTS_CACHE_TTL,
        );
      } else {
        await this.redisService.zRem(scoresKey, hashtagId.toString());
      }

      this.logger.debug(`Updated score for hashtag ${hashtagId} [${category}]: ${score}`);

      // Perform maintenance: cleanup old entries
      // Fire and forget to not block the main flow
      this.cleanupOldEntries(hashtagId, category).catch(err =>
        this.logger.warn(`Cleanup failed for ${hashtagId}: ${err.message}`)
      );

      return score;
    } catch (error) {
      this.logger.error(`Failed to update trending score for hashtag ${hashtagId}:`, error);
      throw error;
    }
  }

  private async getCountForWindow(
    hashtagId: number,
    window: '1h' | '24h',
    category: TrendCategory,
    currentBucket: number,
    bucketsToCount: number,
  ): Promise<number> {
    const promises: Promise<number>[] = [];

    for (let i = 0; i < bucketsToCount; i++) {
      const bucket = currentBucket - i;
      const key = `${this.getHashtagKey(hashtagId, window, category)}:${bucket}`;
      promises.push(this.redisService.get(key).then((val) => (val ? Number.parseInt(val, 10) : 0)));
    }

    const counts = await Promise.all(promises);
    return counts.reduce((sum, count) => sum + count, 0);
  }

  async getTrending(
    category: TrendCategory,
    limit: number = 10,
  ): Promise<Array<{ hashtagId: number; score: number }>> {
    try {
      const scoresKey = this.getScoresKey(category);

      const results = await this.redisService.zRangeWithScores(scoresKey, 0, limit - 1, {
        REV: true,
      });

      return results.map((result) => ({
        hashtagId: Number.parseInt(result.value, 10),
        score: result.score,
      }));
    } catch (error) {
      this.logger.error(`Failed to get trending hashtags for ${category}:`, error);
      throw error;
    }
  }

  async getHashtagCounts(
    hashtagId: number,
    category: TrendCategory,
  ): Promise<{ count1h: number; count24h: number; count7d: number }> {
    try {
      const countsCacheKey = this.getCountsCacheKey(hashtagId, category);
      const cached = await this.redisService.getJSON<CachedCounts>(countsCacheKey);

      if (cached && Date.now() - cached.timestamp < this.COUNTS_CACHE_TTL * 1000) {
        return {
          count1h: cached.count1h,
          count24h: cached.count24h,
          count7d: cached.count7d,
        };
      }

      const now = Date.now();
      const currentHourBucket = this.getTimeBucket(now, 'hour');
      const currentDayBucket = this.getTimeBucket(now, 'day');
      const sevenDaysAgo = now - this.TIME_WINDOWS.SEVEN_DAYS * 1000;

      const [count1h, count24h, count7d] = await Promise.all([
        this.getCountForWindow(hashtagId, '1h', category, currentHourBucket, 1),
        this.getCountForWindow(hashtagId, '24h', category, currentDayBucket, 1),
        this.redisService.zCount(this.getHashtagKey(hashtagId, '7d', category), sevenDaysAgo, now),
      ]);

      await this.redisService.setJSON(
        countsCacheKey,
        { count1h, count24h, count7d, timestamp: now } as CachedCounts,
        this.COUNTS_CACHE_TTL,
      );

      return { count1h, count24h, count7d };
    } catch (error) {
      this.logger.error(`Failed to get hashtag counts for ${hashtagId}:`, error);
      throw error;
    }
  }

  async batchGetHashtagCounts(
    hashtagIds: number[],
    category: TrendCategory,
  ): Promise<Map<number, { count1h: number; count24h: number; count7d: number }>> {
    const results = new Map();

    await Promise.all(
      hashtagIds.map(async (hashtagId) => {
        const counts = await this.getHashtagCounts(hashtagId, category);
        results.set(hashtagId, counts);
      }),
    );

    return results;
  }

  async setHashtagMetadata(hashtagId: number, tag: string, category: TrendCategory): Promise<void> {
    try {
      const metadataKey = this.getMetadataKey(hashtagId, category);
      await this.redisService.setJSON(
        metadataKey,
        { tag, hashtagId },
        this.TIME_WINDOWS.SEVEN_DAYS,
      );
    } catch (error) {
      this.logger.error(`Failed to set hashtag metadata for ${hashtagId}:`, error);
      throw error;
    }
  }

  async getHashtagMetadata(
    hashtagId: number,
    category: TrendCategory,
  ): Promise<{ tag: string; hashtagId: number } | null> {
    try {
      const metadataKey = this.getMetadataKey(hashtagId, category);
      return await this.redisService.getJSON<{ tag: string; hashtagId: number }>(metadataKey);
    } catch (error) {
      this.logger.debug(`Failed to get hashtag metadata for ${hashtagId}:`, error.message);
      return null;
    }
  }

  async batchGetHashtagMetadata(
    hashtagIds: number[],
    category: TrendCategory,
  ): Promise<Map<number, { tag: string; hashtagId: number }>> {
    const results = new Map();

    await Promise.all(
      hashtagIds.map(async (hashtagId) => {
        const metadata = await this.getHashtagMetadata(hashtagId, category);
        if (metadata) {
          results.set(hashtagId, metadata);
        }
      }),
    );

    return results;
  }

  async trackPostHashtags(
    postId: number,
    hashtagIds: number[],
    category: TrendCategory,
    timestamp: number = Date.now(),
  ): Promise<void> {
    if (hashtagIds.length === 0) return;

    try {
      await Promise.all(
        hashtagIds.map((hashtagId) =>
          this.trackHashtagPost(hashtagId, postId, category, timestamp),
        ),
      );

      this.logger.debug(`Tracked ${hashtagIds.length} hashtags for post ${postId} [${category}]`);
    } catch (error) {
      this.logger.error(`Failed to batch track hashtags for post ${postId}:`, error);
      throw error;
    }
  }

  async cleanupOldEntries(hashtagId: number, category: TrendCategory): Promise<void> {
    try {
      const now = Date.now();
      const sevenDaysAgo = now - this.TIME_WINDOWS.SEVEN_DAYS * 1000;

      await this.redisService.zRemRangeByScore(
        this.getHashtagKey(hashtagId, '7d', category),
        0,
        sevenDaysAgo,
      );
    } catch (error) {
      this.logger.error(`Failed to cleanup old entries for hashtag ${hashtagId}:`, error);
      // Don't throw here, just log, as this is maintenance
    }
  }

  // async clearCategoryData(category: TrendCategory): Promise<void> {
  //   try {
  //     const pattern = `trending:*:${category}`;
  //     await this.redisService.delPattern(pattern);
  //     this.logger.log(`Cleared trending data for ${category}`);
  //   } catch (error) {
  //     this.logger.error(`Failed to clear category data for ${category}:`, error);
  //     throw error;
  //   }
  // }

  async forceScoreUpdate(hashtagId: number, category: TrendCategory): Promise<number> {
    return await this.updateTrendingScore(hashtagId, category);
  }
}
