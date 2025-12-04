import { Module } from '@nestjs/common';
import { PostController } from './post.controller';
import { PostService } from './services/post.service';
import { RedisQueues, Services } from 'src/utils/constants';
import { LikeService } from './services/like.service';
import { RepostService } from './services/repost.service';
import { MentionService } from './services/mention.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { StorageService } from 'src/storage/storage.service';
import { AiSummarizationService } from 'src/ai-integration/services/summarization.service';
import { BullModule } from '@nestjs/bullmq';
import { HttpModule } from '@nestjs/axios';
import { MLService } from './services/ml.service';
import { RedisService } from 'src/redis/redis.service';
import { GatewayModule } from 'src/gateway/gateway.module';

@Module({
  controllers: [PostController],
  providers: [
    PostService,
    {
      provide: Services.POST,
      useClass: PostService,
    },
    {
      provide: Services.LIKE,
      useClass: LikeService,
    },
    {
      provide: Services.REPOST,
      useClass: RepostService,
    },
    {
      provide: Services.MENTION,
      useClass: MentionService,
    },
    {
      provide: Services.STORAGE,
      useClass: StorageService,
    },
    {
      provide: Services.AI_SUMMARIZATION,
      useClass: AiSummarizationService,
    },
    {
      provide: Services.ML,
      useClass: MLService,
    },
    {
      provide: Services.REDIS,
      useClass: RedisService,
    },
    MLService,
  ],
  imports: [
    PrismaModule,
    HttpModule,
    GatewayModule,
    BullModule.registerQueue({
      name: RedisQueues.postQueue.name,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: true,
      },
    }),
  ],
})
export class PostModule {}
