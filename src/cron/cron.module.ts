import { Module } from '@nestjs/common';
import { CronService } from './cron.service';
import { PostModule } from 'src/post/post.module';

@Module({
  imports: [PostModule],
  providers: [CronService],
  exports: [CronService],
})
export class CronModule {}
