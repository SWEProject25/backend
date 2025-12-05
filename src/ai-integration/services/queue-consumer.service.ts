import { Processor, WorkerHost } from '@nestjs/bullmq';
import { RedisQueues, Services } from 'src/utils/constants';
import { AiSummarizationService } from './summarization.service';
import { Job } from 'bullmq';
import { SummarizeJob } from 'src/common/interfaces/summarizeJob.interface';
import { Inject } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Processor(RedisQueues.postQueue.name)
export class QueueConsumerService extends WorkerHost {
  constructor(
    @Inject(Services.AI_SUMMARIZATION)
    private readonly aiSummarizationService: AiSummarizationService,
    @Inject(Services.PRISMA)
    private readonly prismaService: PrismaService,
  ) {
    super();
  }

  async process(job: Job<SummarizeJob>): Promise<void> {
    switch (job.name) {
      case RedisQueues.postQueue.processes.summarizePostContent:
        this.handleSummarizePostContent(job);

      default:
        throw new Error(`No handler for job name: ${job.name}`);
    }
  }

  private async handleSummarizePostContent(job: Job<SummarizeJob>) {
    const { postContent, postId } = job.data;
    const summary = await this.aiSummarizationService.summarizePost(postContent);

    await this.prismaService.post.update({
      where: { id: postId },
      data: { summary },
    });
  }
}
