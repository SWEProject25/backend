import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { RedisQueues, Services } from 'src/utils/constants';
import { HashtagTrendService } from '../services/hashtag-trends.service';

@Processor(RedisQueues.bulkHashTagQueue.name)
export class HashtagBulkRecalculateProcessor extends WorkerHost {
  private readonly logger = new Logger(HashtagBulkRecalculateProcessor.name);

  constructor(
    @Inject(Services.HASHTAG_TRENDS)
    private readonly hashtagTrendService: HashtagTrendService,
  ) {
    super();
  }

  public async process(job: Job<{ hashtagIds: number[] }>): Promise<any> {
    this.logger.log(
      `Processing bulk recalculation job ${job.id} (attempt ${job.attemptsMade + 1}/${job.opts.attempts})`,
    );

    try {
      const { hashtagIds } = job.data;

      if (!hashtagIds || hashtagIds.length === 0) {
        this.logger.warn('No hashtag IDs provided, skipping bulk recalculation');
        return { processed: 0, skipped: true };
      }

      this.logger.log(`Starting bulk calculation for ${hashtagIds.length} hashtags`);

      const batchSize = 20;
      let processed = 0;
      let failed = 0;

      // Process in batches to avoid overwhelming the database
      for (let i = 0; i < hashtagIds.length; i += batchSize) {
        const batch = hashtagIds.slice(i, i + batchSize);

        this.logger.debug(
          `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(hashtagIds.length / batchSize)} (${batch.length} hashtags)`,
        );

        // Process batch in parallel
        const results = await Promise.allSettled(
          batch.map((hashtagId) => this.hashtagTrendService.calculateTrend(hashtagId)),
        );

        // Count successes and failures
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            processed++;
          } else {
            failed++;
            this.logger.error(
              `Failed to calculate trend for hashtag ${batch[index]}:`,
              result.reason?.message,
            );
          }
        });

        // Update job progress
        const progress = ((i + batch.length) / hashtagIds.length) * 100;
        await job.updateProgress(Math.min(progress, 100));

        // Small delay between batches to prevent overload
        if (i + batchSize < hashtagIds.length) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      const result = {
        processed,
        failed,
        total: hashtagIds.length,
        batchSize,
        timestamp: new Date().toISOString(),
      };

      this.logger.log(
        `Bulk calculation completed: ${processed}/${hashtagIds.length} hashtags (${failed} failed)`,
      );

      return result;
    } catch (error) {
      this.logger.error(`Error processing bulk recalculation job ${job.id}:`, error);
      throw error; // Re-throw to trigger retry
    }
  }
}
