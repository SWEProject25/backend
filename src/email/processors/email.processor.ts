import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { RedisQueues, Services } from 'src/utils/constants';
import { EmailService } from '../email.service';
import { EmailJob } from '../interfaces/email-job.interface';

@Processor(RedisQueues.emailQueue.name)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    @Inject(Services.EMAIL)
    private readonly emailService: EmailService,
  ) {
    super();
  }

  public async process(job: Job<EmailJob>): Promise<any> {
    this.logger.log(
      `Processing email job ${job.id} of type ${job.name} (attempt ${job.attemptsMade + 1}/${job.opts.attempts})`,
    );

    try {
      const { recipients, subject, html, text } = job.data;

      if (!recipients || recipients.length === 0) {
        this.logger.warn(`Job ${job.id}: No recipients provided, skipping`);
        return { success: false, error: 'No recipients provided' };
      }

      this.logger.log(`Sending email to ${recipients.length} recipient(s): ${subject}`);

      const result = await this.emailService.sendEmail({
        recipients,
        subject,
        html,
        text,
      });

      if (result?.success) {
        this.logger.log(`Job ${job.id} completed successfully. Message ID: ${result.messageId}`);
        return {
          success: true,
          messageId: result.messageId,
          timestamp: new Date().toISOString(),
        };
      } else {
        this.logger.error(`Job ${job.id} failed: Email sending returned no success result`);
        throw new Error('Email sending failed');
      }
    } catch (error) {
      this.logger.error(`Error processing job ${job.id} (${job.name}):`, error);
      throw error;
    }
  }
}
