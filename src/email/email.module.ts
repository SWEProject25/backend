import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { ConfigModule } from '@nestjs/config';
import { EmailController } from './email.controller';
import mailerConfig from 'src/common/config/mailer.config';
import { RedisQueues, Services } from 'src/utils/constants';
import { BullModule } from '@nestjs/bullmq';
import { EmailProcessor } from './processors/email.processor';

@Module({
  providers: [
    {
      provide: Services.EMAIL,
      useClass: EmailService,
    },
    {
      provide: Services.EMAIL_JOB_QUEUE,
      useClass: EmailProcessor,
    },
  ],
  exports: [
    {
      provide: Services.EMAIL,
      useClass: EmailService,
    },
  ],
  imports: [
    ConfigModule.forFeature(mailerConfig),
    BullModule.registerQueue({
      name: RedisQueues.emailQueue.name,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    }),
  ],
  controllers: [EmailController],
})
export class EmailModule {}
