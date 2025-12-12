import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { RedisQueues, Services } from 'src/utils/constants';
import { HashtagTrendService } from '../services/hashtag-trends.service';
import { TrendCategory, ALL_TREND_CATEGORIES } from '../enums/trend-category.enum';

@Processor(RedisQueues.bulkHashTagQueue.name)
export class HashtagBulkRecalculateProcessor extends WorkerHost {
  private readonly logger = new Logger(HashtagBulkRecalculateProcessor.name);

  constructor(
    @Inject(Services.HASHTAG_TRENDS)
    private readonly hashtagTrendService: HashtagTrendService,
  ) {
    super();
  }

  public async process(job: Job<{ hashtagIds: number[]; category?: TrendCategory }>): Promise<any> {
    this.logger.log(
      `Processing bulk recalculation job ${job.id} (attempt ${job.attemptsMade + 1}/${job.opts.attempts})`,
    );

    try {
      const { hashtagIds, category } = job.data;

      if (!hashtagIds || hashtagIds.length === 0) {
        this.logger.warn('No hashtag IDs provided, skipping bulk recalculation');
        return { processed: 0, skipped: true };
      }

      // If no category specified, calculate for all categories
      const categories = category ? [category] : ALL_TREND_CATEGORIES;

      this.logger.log(`Starting bulk calculation for ${hashtagIds.length} hashtags`);

      const batchSize = 50;
      let totalProcessed = 0;
      let totalFailed = 0;

      for (let i = 0; i < hashtagIds.length; i += batchSize) {
        const batch = hashtagIds.slice(i, i + batchSize);

        const { processed, failed } = await this.hashtagTrendService.calculateTrendsBatch(
          batch,
          categories,
        );

        totalProcessed += processed;
        totalFailed += failed;

        // Update job progress
        const progress = ((i + batch.length) / hashtagIds.length) * 100;
        await job.updateProgress(Math.min(progress, 100));
      }

      const result = {
        processed: totalProcessed,
        failed: totalFailed,
        total: hashtagIds.length * categories.length,
        batchSize,
        hashtagsProcessed: hashtagIds.length,
        categories: categories.length,
        timestamp: new Date().toISOString(),
      };

      return result;
    } catch (error) {
      this.logger.error(`Error processing bulk recalculation job ${job.id}:`, error);
      throw error; // Re-throw to trigger retry
    }
  }
}
