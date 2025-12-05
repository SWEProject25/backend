import { ConfigModule } from '@nestjs/config';
import redisConfig from 'src/config/redis.config';
import { Services } from 'src/utils/constants';
import { RedisService } from './redis.service';
import { Module } from '@nestjs/common';

@Module({
  imports: [ConfigModule.forFeature(redisConfig)],
  providers: [
    {
      provide: Services.REDIS,
      useClass: RedisService,
    },
  ],
  exports: [
    {
      provide: Services.REDIS,
      useClass: RedisService,
    },
  ],
})
export class RedisModule {}
