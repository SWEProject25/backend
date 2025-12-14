import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { HashtagTrendService } from 'src/post/services/hashtag-trends.service';
import { CronJobs, Services } from 'src/utils/constants';
import { ALL_TREND_CATEGORIES, TrendCategory } from 'src/post/enums/trend-category.enum';
import { UserService } from 'src/user/user.service';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    @Inject(Services.HASHTAG_TRENDS)
    private readonly hashtagTrendService: HashtagTrendService,
    @Inject(Services.USER)
    private readonly userService: UserService,
  ) {}

  // Calculate hashtag trends every 30 minutes
  @Cron('0 */30 * * * *', {
    name: CronJobs.trendsJob.name,
    timeZone: 'UTC',
  })
  async handleTrendCalculation() {
    const results: Array<{ category: string; count?: number; error?: string; userCount?: number }> =
      [];

    for (const category of ALL_TREND_CATEGORIES) {
      try {
        if (category === TrendCategory.PERSONALIZED) {
          // calculate for active users
          const activeUsers = await this.userService.getActiveUsers();
          let totalCount = 0;
          for (const user of activeUsers) {
            try {
              const count = await this.hashtagTrendService.recalculateTrends(category, user.id);
              totalCount += count;
            } catch (error) {
              this.logger.warn(
                `Failed to calculate personalized trends for user ${user.id}:`,
                error.message,
              );
            }
          }

          results.push({ category, count: totalCount, userCount: activeUsers.length });
        } else {
          const count = await this.hashtagTrendService.recalculateTrends(category);
          results.push({ category, count });
        }
      } catch (error) {
        results.push({ category, error: error.message });
      }
    }

    const totalQueued = results.reduce((sum, r) => sum + (r.count || 0), 0);
    this.logger.log(
      `Completed scheduled trend calculation. Total queued: ${totalQueued} hashtags across ${ALL_TREND_CATEGORIES.length} categories`,
    );

    return results;
  }
}
