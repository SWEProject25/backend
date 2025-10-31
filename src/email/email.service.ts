import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import mailerConfig from './../common/config/mailer.config';
import { SendEmailDto } from './dto/send-email.dto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { EmailClient, EmailMessage, KnownEmailSendStatus } from '@azure/communication-email';

@Injectable()
export class EmailService {
  private readonly emailClient: EmailClient;
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @Inject(mailerConfig.KEY)
    private readonly mailerConfiguration: ConfigType<typeof mailerConfig>,
  ) {
    const connectionString = mailerConfiguration.azure.connectionString!;

    if (!connectionString) {
      throw new Error('AZURE_EMAIL_CONNECTION_STRING is not defined');
    }

    this.emailClient = new EmailClient(connectionString);
    this.logger.log('Azure Email Client initialized successfully');
  }

  public async sendEmail(
    sendEmailDto: SendEmailDto,
  ): Promise<{ success: boolean; messageId?: string } | null> {
    const { recipients, subject, html, text } = sendEmailDto;

    if (!recipients || recipients.length === 0) {
      this.logger.error('No recipients provided');
      return null;
    }

    const toRecipients = recipients.map((recipient) => {
      if (typeof recipient === 'string') {
        return { address: recipient };
      }
      return {
        address: recipient.email,
        displayName: recipient.name || '',
      };
    });

    const message: EmailMessage = {
      senderAddress: this.mailerConfiguration.azure.fromEmail!,
      content: {
        subject: subject,
        plainText: text || '',
        html: html || '',
      },
      recipients: {
        to: toRecipients,
      },
    };

    try {
      this.logger.log(`Attempting to send email from: ${process.env.AZURE_EMAIL_FROM}`);
      this.logger.log(`Recipients: ${recipients.join(', ')}`);

      const poller = await this.emailClient.beginSend(message);
      const response = await poller.pollUntilDone();

      if (response.status === KnownEmailSendStatus.Succeeded) {
        this.logger.log(`Email sent successfully. Message ID: ${response.id}`);
        return {
          success: true,
          messageId: response.id,
        };
      } else {
        this.logger.error(`Email send failed with status: ${response.status}`);
        return null;
      }
    } catch (error) {
      this.logger.error(`Failed to send email: ${error.message || 'Unknown error'}`);
      this.logger.error(`Error code: ${error.code || 'N/A'}`);
      this.logger.error(`Status code: ${error.statusCode || 'N/A'}`);
      return null;
    }
  }

  public renderTemplate(path: string, variables: Record<string, string>): string {
    const templatePath = join(process.cwd(), 'src', 'email', 'templates', path);

    try {
      let template = readFileSync(templatePath, 'utf-8');
      Object.keys(variables).forEach((key) => {
        template = template.replace(`{{${key}}}`, variables[key]);
      });

      return template;
    } catch (error) {
      this.logger.error(`Error reading template: ${path}`, error);
      throw error;
    }
  }
}
