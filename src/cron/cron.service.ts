import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HashtagTrendService } from 'src/post/services/hashtag-trends.service';
import { CronJobs, Services } from 'src/utils/constants';
import { ALL_TREND_CATEGORIES } from 'src/post/enums/trend-category.enum';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    @Inject(Services.HASHTAG_TRENDS)
    private readonly hashtagTrendService: HashtagTrendService,
  ) {}

  // Calculate trends every 15 minutes
  @Cron('0 */15 * * * *', {
    name: CronJobs.trendsJob.name,
    timeZone: 'UTC',
  })
  async handleTrendCalculation() {
    const results: Array<{ category: string; count?: number; error?: string }> = [];

    for (const category of ALL_TREND_CATEGORIES) {
      try {
        const count = await this.hashtagTrendService.recalculateTrends(category);
        results.push({ category, count });
      } catch (error) {
        results.push({ category, error: error.message });
      }
    }
    const totalQueued = results.reduce((sum, r) => sum + (r.count || 0), 0);
    this.logger.log(
      `✅ Completed scheduled trend calculation. Total queued: ${totalQueued} hashtags across ${ALL_TREND_CATEGORIES.length} categories`,
    );

    return results;
  }
}
