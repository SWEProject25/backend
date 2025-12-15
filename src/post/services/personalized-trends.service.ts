import { Inject, Injectable, Logger } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { Services } from 'src/utils/constants';
import { TrendCategory, CATEGORY_TO_INTERESTS } from '../enums/trend-category.enum';
import { RedisTrendingService } from './redis-trending.service';
import { UsersService } from 'src/users/users.service';

interface UserInterests {
  userId: number;
  interestSlugs: string[];
  categories: TrendCategory[];
}

@Injectable()
export class PersonalizedTrendsService {
  private readonly logger = new Logger(PersonalizedTrendsService.name);
  private readonly PERSONALIZED_CACHE_TTL = 300; // 5 minutes
  private readonly USER_INTERESTS_CACHE_TTL = 3600; // 1 hour

  private readonly userInterestsCache = new Map<
    number,
    {
      interests: UserInterests;
      timestamp: number;
    }
  >();

  constructor(
    @Inject(Services.REDIS)
    private readonly redisService: RedisService,
    @Inject(Services.PRISMA)
    private readonly prismaService: PrismaService,
    @Inject(Services.REDIS_TRENDING)
    private readonly redisTrendingService: RedisTrendingService,
    @Inject(Services.USERS)
    private readonly usersService: UsersService,
  ) {}

  async getPersonalizedTrending(
    userId: number,
    limit: number = 10,
  ): Promise<Array<{ tag: string; totalPosts: number; score: number; categories: string[] }>> {
    const cacheKey = `personalized:trending:${userId}:${limit}`;
    const cached = await this.redisService.getJSON<any[]>(cacheKey);
    if (cached && cached.length > 0) {
      this.logger.debug(`Returning cached personalized trends for user ${userId}`);
      return cached;
    }

    try {
      const userInterests = await this.usersService.getUserInterests(userId);
      const interestSlugs = userInterests.map((ui) => ui.slug);
      const categories = this.mapInterestsToCategories(interestSlugs);
      if (categories.length === 0) {
        this.logger.debug(`User ${userId} has no interests, falling back to GENERAL`);
        return await this.getTrendingForCategory(TrendCategory.GENERAL, limit);
      }

      const categoryTrends = await Promise.all(
        categories.map(async (category) => ({
          category,
          trends: await this.redisTrendingService.getTrending(category, limit * 2),
        })),
      );

      const combinedTrends = this.combineAndRankTrends(categoryTrends, limit, categories);

      if (combinedTrends.length === 0) {
        this.logger.warn(`No personalized trends for user ${userId}, using GENERAL`);
        return await this.getTrendingForCategory(TrendCategory.GENERAL, limit);
      }

      const results = await Promise.all(
        combinedTrends.map(async (trend) => {
          let metadata = await this.redisTrendingService.getHashtagMetadata(
            trend.hashtagId,
            trend.primaryCategory,
          );

          if (!metadata) {
            const hashtag = await this.prismaService.hashtag.findUnique({
              where: { id: trend.hashtagId },
              select: { tag: true },
            });

            if (!hashtag) return null;

            metadata = { tag: hashtag.tag, hashtagId: trend.hashtagId };
            await this.redisTrendingService.setHashtagMetadata(
              trend.hashtagId,
              hashtag.tag,
              trend.primaryCategory,
            );
          }

          const counts = await this.redisTrendingService.getHashtagCounts(
            trend.hashtagId,
            trend.primaryCategory,
          );

          return {
            tag: `#${metadata.tag}`,
            totalPosts: counts.count7d,
            score: trend.combinedScore,
            categories: trend.categories,
          };
        }),
      );

      const filteredResults = results.filter((r) => r !== null);

      await this.redisService.setJSON(cacheKey, filteredResults, this.PERSONALIZED_CACHE_TTL);

      this.logger.debug(
        `Generated ${filteredResults.length} personalized trends for user ${userId}`,
      );

      return filteredResults;
    } catch (error) {
      this.logger.error(`Failed to get personalized trends for user ${userId}:`, error);
      return await this.getTrendingForCategory(TrendCategory.GENERAL, limit);
    }
  }

  private combineAndRankTrends(
    categoryTrends: Array<{
      category: TrendCategory;
      trends: Array<{ hashtagId: number; score: number }>;
    }>,
    limit: number,
    userCategories: TrendCategory[],
  ): Array<{
    hashtagId: number;
    combinedScore: number;
    primaryCategory: TrendCategory;
    categories: string[];
  }> {
    const hashtagScores = new Map<
      number,
      {
        scores: Map<TrendCategory, number>;
        totalScore: number;
      }
    >();

    for (const { category, trends } of categoryTrends) {
      for (const { hashtagId, score } of trends) {
        if (!hashtagScores.has(hashtagId)) {
          hashtagScores.set(hashtagId, {
            scores: new Map(),
            totalScore: 0,
          });
        }

        const hashtagData = hashtagScores.get(hashtagId)!;
        const categoryWeight = this.getCategoryWeight(category, userCategories);
        const weightedScore = score * categoryWeight;

        hashtagData.scores.set(category, score);
        hashtagData.totalScore += weightedScore;
      }
    }

    const rankedTrends = Array.from(hashtagScores.entries())
      .map(([hashtagId, data]) => {
        let primaryCategory = TrendCategory.GENERAL;
        let maxScore = 0;

        for (const [category, score] of data.scores) {
          if (score > maxScore) {
            maxScore = score;
            primaryCategory = category;
          }
        }

        return {
          hashtagId,
          combinedScore: data.totalScore,
          primaryCategory,
          categories: Array.from(data.scores.keys()),
        };
      })
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, limit);

    return rankedTrends;
  }

  private getCategoryWeight(category: TrendCategory, userCategories: TrendCategory[]): number {
    if (category === TrendCategory.GENERAL) {
      return 0.5;
    }

    if (userCategories.includes(category)) {
      return 1.0;
    }

    return 0.3;
  }

  private mapInterestsToCategories(interestSlugs: string[]): TrendCategory[] {
    const categories = new Set<TrendCategory>();

    categories.add(TrendCategory.GENERAL);

    for (const slug of interestSlugs) {
      for (const [category, slugs] of Object.entries(CATEGORY_TO_INTERESTS)) {
        if (slugs.includes(slug)) {
          categories.add(category as TrendCategory);
        }
      }
    }

    return Array.from(categories);
  }

  private async getTrendingForCategory(
    category: TrendCategory,
    limit: number,
  ): Promise<Array<{ tag: string; totalPosts: number; score: number; categories: string[] }>> {
    const trending = await this.redisTrendingService.getTrending(category, limit);

    const results = await Promise.all(
      trending.map(async (item) => {
        let metadata = await this.redisTrendingService.getHashtagMetadata(item.hashtagId, category);

        if (!metadata) {
          const hashtag = await this.prismaService.hashtag.findUnique({
            where: { id: item.hashtagId },
            select: { tag: true },
          });

          if (!hashtag) return null;

          metadata = { tag: hashtag.tag, hashtagId: item.hashtagId };
          await this.redisTrendingService.setHashtagMetadata(item.hashtagId, hashtag.tag, category);
        }

        const counts = await this.redisTrendingService.getHashtagCounts(item.hashtagId, category);

        return {
          tag: `#${metadata.tag}`,
          totalPosts: counts.count7d,
          score: item.score,
          categories: [category],
        };
      }),
    );

    return results.filter((r) => r !== null);
  }

  async invalidateUserCache(userId: number): Promise<void> {
    const patterns = [`personalized:trending:${userId}:*`, `user:interests:${userId}`];

    await Promise.all(patterns.map((pattern) => this.redisService.delPattern(pattern)));

    this.userInterestsCache.delete(userId);

    this.logger.debug(`Invalidated cache for user ${userId}`);
  }

  async trackUserActivity(userId: number): Promise<void> {
    const activeUsersKey = 'trending:active_users';
    const score = Date.now();

    try {
      await this.redisService.zAdd(activeUsersKey, [{ score, value: userId.toString() }]);
      await this.redisService.zRemRangeByRank(activeUsersKey, 0, -1001);
    } catch (error) {
      this.logger.warn(`Failed to track activity for user ${userId}:`, error);
    }
  }
}
