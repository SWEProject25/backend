import { Processor, WorkerHost } from '@nestjs/bullmq';
import { RedisQueues, Services } from 'src/utils/constants';
import { HashtagTrendService } from '../services/hashtag-trends.service';
import { Job } from 'bullmq';
import { Inject, Logger } from '@nestjs/common';
import { TrendCategory, ALL_TREND_CATEGORIES } from '../enums/trend-category.enum';

@Processor(RedisQueues.hashTagQueue.name)
export class HashtagCalculateTrendsProcessor extends WorkerHost {
  private readonly logger = new Logger(HashtagCalculateTrendsProcessor.name);

  constructor(
    @Inject(Services.HASHTAG_TRENDS)
    private readonly hashtagTrendService: HashtagTrendService,
  ) {
    super();
  }

  public async process(
    job: Job<{ hashtagIds: number[]; category?: TrendCategory; userId: number | null }>,
  ): Promise<any> {
    this.logger.log(
      `Processing job ${job.id} of type ${job.name} (attempt ${job.attemptsMade + 1}/${job.opts.attempts})`,
    );

    try {
      const { hashtagIds, category, userId } = job.data;

      if (!hashtagIds || hashtagIds.length === 0) {
        this.logger.warn('No hashtag IDs provided, skipping job');
        return { processed: 0, skipped: true };
      }
      const categories = category ? [category] : ALL_TREND_CATEGORIES;

      this.logger.log(`Calculating trends for ${hashtagIds.length} hashtags`);

      let processed = 0;
      let failed = 0;

      for (const hashtagId of hashtagIds) {
        for (const cat of categories) {
          try {
            if (cat === TrendCategory.PERSONALIZED && !userId) {
              continue;
            }
            await this.hashtagTrendService.calculateTrend(hashtagId, cat, userId);
            processed++;
          } catch (error) {
            this.logger.error(
              `Failed to calculate trend for hashtag ${hashtagId} [${cat}]:`,
              error,
            );
            failed++;
          }
        }
      }

      const result = {
        processed,
        failed,
        total: hashtagIds.length * categories.length,
        timestamp: new Date().toISOString(),
      };

      return result;
    } catch (error) {
      this.logger.error(`Error processing job ${job.id} (${job.name}):`, error);
      throw error; // Re-throw to trigger retry
    }
  }
}
