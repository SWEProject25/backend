import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { RedisQueues, Services } from 'src/utils/constants';
import { TrendCategory, CATEGORY_TO_INTERESTS } from '../enums/trend-category.enum';
import { UsersService } from 'src/users/users.service';

const HASHTAG_TRENDS_TOKEN_PREFIX = 'hashtags:trending:';
const HASHTAG_RECALC_PREFIX = 'hashtags:recalculating:';
const TRENDS_COOLDOWN_PREFIX = 'hashtags:cooldown:';


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
      if (category === TrendCategory.PERSONALIZED && userId) {
        const userInterests = await this.usersService.getUserInterests(userId);
        interestSlugs = userInterests.map((userInterests) => userInterests.slug);
        this.logger.debug(`User ${userId} interests for personalized trends: ${interestSlugs.join(', ')}`);
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

  public async calculateTrendsBulk(
    hashtagIds: number[],
    category: TrendCategory = TrendCategory.GENERAL,
    userId: number | null,
  ): Promise<void> {
    if (hashtagIds.length === 0) return;

    try {
      let interestSlugs = CATEGORY_TO_INTERESTS[category];
      if (category === TrendCategory.PERSONALIZED && userId) {
        const userInterests = await this.usersService.getUserInterests(userId);
        interestSlugs = userInterests.map((ui) => ui.slug);
      }

      const shouldFilterByInterest = !(category === TrendCategory.GENERAL || interestSlugs.length === 0);
      const userIdVal = category === TrendCategory.PERSONALIZED ? userId : null;

      const deleteQuery = Prisma.sql`
        DELETE FROM "hashtag_trends"
        WHERE "hashtag_id" IN (${Prisma.join(hashtagIds)})
        AND "category" = ${category}
        AND ("user_id" = ${userIdVal} OR (${userIdVal} IS NULL AND "user_id" IS NULL))
      `;

      const insertQuery = Prisma.sql`
        INSERT INTO "hashtag_trends" ("hashtag_id", "category", "user_id", "post_count_1h", "post_count_24h", "post_count_7d", "trending_score", "calculated_at")
        SELECT
            ph."A" as hashtag_id,
            ${category},
            ${userIdVal},
            COUNT(CASE WHEN p.created_at >= NOW() - INTERVAL '1 hour' THEN 1 END)::int as post_count_1h,
            COUNT(CASE WHEN p.created_at >= NOW() - INTERVAL '24 hours' THEN 1 END)::int as post_count_24h,
            COUNT(CASE WHEN p.created_at >= NOW() - INTERVAL '7 days' THEN 1 END)::int as post_count_7d,
            (
                COUNT(CASE WHEN p.created_at >= NOW() - INTERVAL '1 hour' THEN 1 END) * 10.0 +
                COUNT(CASE WHEN p.created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) * 2.0 +
                COUNT(CASE WHEN p.created_at >= NOW() - INTERVAL '7 days' THEN 1 END) * 0.5
            )::float as trending_score,
            NOW()
        FROM "_PostHashtags" ph
        JOIN "posts" p ON ph."B" = p.id
        LEFT JOIN "interests" i ON p.interest_id = i.id
        WHERE 
            ph."A" IN (${Prisma.join(hashtagIds)})
            AND p."is_deleted" = false
            AND p."created_at" >= NOW() - INTERVAL '7 days'
            ${shouldFilterByInterest
          ? Prisma.sql`AND i.slug IN (${Prisma.join(interestSlugs)})`
          : Prisma.empty
        }
        GROUP BY ph."A"
      `;

      await this.prismaService.$transaction([
        this.prismaService.$executeRaw(deleteQuery),
        this.prismaService.$executeRaw(insertQuery),
      ]);

      this.logger.log(`Bulk calculated trends for ${hashtagIds.length} hashtags [${category}]`);
    } catch (error) {
      this.logger.error(`Error in bulk trend calculation:`, error);
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

    // Check if we have ANY recent calculation for this category/user, even if score is 0
    // This prevents infinite loops where we calculate -> get 0 score -> calculate again
    const anyRecentCalculation = await this.prismaService.hashtagTrend.findFirst({
      where: {
        category,
        calculated_at: { gte: lastDay },
        ...(category === TrendCategory.PERSONALIZED && userId ? { user_id: userId } : {}),
      },
    });

    // Check for cooldown to prevent infinite calculation loops
    const cooldownKey = `${TRENDS_COOLDOWN_PREFIX}${category}${userId ? `:${userId}` : ''}`;
    const isInCooldown = await this.redisService.get(cooldownKey);

    if (trends.length === 0) {
      // If in cooldown, don't trigger another calculation
      if (isInCooldown) {
        this.logger.debug(`Trends for ${category} are in cooldown, skipping recalculation`);
        return [];
      }

      // Only recalculate if we haven't calculated at all in the last 24h
      if (!anyRecentCalculation) {
        const recalcKey =
          category === TrendCategory.PERSONALIZED && userId
            ? `${HASHTAG_RECALC_PREFIX}${category}:${userId}`
            : `${HASHTAG_RECALC_PREFIX}${category}`;

        const isRecalculating = await this.redisService.get(recalcKey);

        if (!isRecalculating) {
          this.logger.log(`No recent trends found for ${category} (User: ${userId}), triggering recalculation`);
          // Set lock for 2 minutes to prevent duplicate jobs
          await this.redisService.set(recalcKey, '1', 120);

          this.recalculateTrends(category, userId).catch((err) => {
            this.logger.error(`Background recalculation failed for ${category}:`, err);
            // Optional: release lock on error, but TTL will handle it
          });
        } else {
          this.logger.debug(`Recalculation already in progress for ${category} (User: ${userId})`);
        }
      } else {
        this.logger.debug(`Recent trends exist but score 0 for ${category}, returning empty`);
      }
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
      this.logger.log(`Queueing ${activeHashtags.length} hashtags for recalculation (Category: ${category}, User: ${userId})`);
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

    // Set cooldown to prevent immediate re-triggering if results are empty
    const cooldownKey = `${TRENDS_COOLDOWN_PREFIX}${category}${userId ? `:${userId}` : ''}`;
    await this.redisService.set(cooldownKey, '1', 300); // 5 minutes cooldown

    return activeHashtags.length;
  }
}
