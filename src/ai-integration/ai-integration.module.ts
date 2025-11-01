import { Module } from '@nestjs/common';
import { AiSummarizationService } from './services/summarization.service';
import { RedisQueues, Services } from 'src/utils/constants';
import { PrismaModule } from 'src/prisma/prisma.module';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: RedisQueues.postQueue.name,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: true,
      },
    }),
  ],
  providers: [
    {
      provide: Services.AI_SUMMARIZATION,
      useClass: AiSummarizationService,
    },
  ],
  exports: [
    {
      provide: Services.AI_SUMMARIZATION,
      useClass: AiSummarizationService,
    },
  ],
})
export class AiIntegrationModule { }
