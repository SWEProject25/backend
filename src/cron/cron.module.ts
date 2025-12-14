import { Module } from '@nestjs/common';
import { CronService } from './cron.service';
import { PostModule } from 'src/post/post.module';
import { UserModule } from 'src/user/user.module';

@Module({
  imports: [PostModule, UserModule],
  providers: [CronService],
  exports: [CronService],
})
export class CronModule {}
