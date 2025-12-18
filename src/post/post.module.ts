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
import { HashtagTrendService } from './services/hashtag-trends.service';
import { RedisModule } from 'src/redis/redis.module';
import { HashtagController } from './hashtag.controller';
import { GatewayModule } from 'src/gateway/gateway.module';
import { UsersModule } from 'src/users/users.module';
import { UserModule } from 'src/user/user.module';
import { RedisTrendingService } from './services/redis-trending.service';
import { PersonalizedTrendsService } from './services/personalized-trends.service';

@Module({
  controllers: [PostController, HashtagController],
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
      provide: Services.ML_SERVICE,
      useClass: MLService,
    },
    MLService,
    {
      provide: Services.HASHTAG_TRENDS,
      useClass: HashtagTrendService,
    },
    {
      provide: Services.REDIS_TRENDING,
      useClass: RedisTrendingService,
    },
    {
      provide: Services.PERSONALIZED_TRENDS,
      useClass: PersonalizedTrendsService,
    },
  ],
  imports: [
    PrismaModule,
    HttpModule,
    RedisModule,
    GatewayModule,
    UsersModule,
    UserModule,
    BullModule.registerQueue({
      name: RedisQueues.postQueue.name,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: true,
      },
    }),
  ],
  exports: [
    {
      provide: Services.HASHTAG_TRENDS,
      useClass: HashtagTrendService,
    },
    Services.POST,
  ],
})
export class PostModule {}
