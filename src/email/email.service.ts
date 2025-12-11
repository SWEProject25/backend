import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import mailerConfig from './../common/config/mailer.config';
import { SendEmailDto } from './dto/send-email.dto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Resend } from 'resend';
import { EmailClient, EmailMessage, KnownEmailSendStatus } from '@azure/communication-email';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly resendClient: Resend | null;
  private readonly azureClient: EmailClient | null;
  private readonly awsSesTransporter: Transporter | null;
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @Inject(mailerConfig.KEY)
    private readonly mailerConfiguration: ConfigType<typeof mailerConfig>,
  ) {
    // Initialize AWS SES SMTP Client
    const awsSesConfig = mailerConfiguration.awsSes;
    if (awsSesConfig.smtpUsername && awsSesConfig.smtpPassword) {
      try {
        this.awsSesTransporter = nodemailer.createTransport({
          host: awsSesConfig.smtpHost,
          port: awsSesConfig.smtpPort,
          secure: false, // Use TLS
          auth: {
            user: awsSesConfig.smtpUsername,
            pass: awsSesConfig.smtpPassword,
          },
        });
        this.logger.log('✅ AWS SES SMTP Client initialized successfully');
      } catch (error) {
        this.awsSesTransporter = null;
        this.logger.warn('⚠️  Failed to initialize AWS SES Client', error);
      }
    } else {
      this.awsSesTransporter = null;
      this.logger.warn('⚠️  AWS SES credentials not provided');
    }

    // Initialize Resend Client
    const resendApiKey = mailerConfiguration.resend.apiKey;
    if (resendApiKey) {
      try {
        this.resendClient = new Resend(resendApiKey);
        this.logger.log('✅ Resend Email Client initialized successfully');
      } catch (error) {
        this.resendClient = null;
        this.logger.warn('⚠️  Failed to initialize Resend Email Client', error);
      }
    } else {
      this.resendClient = null;
      this.logger.warn('⚠️  Resend API Key not provided');
    }

    // Initialize Azure Email Client
    const azureConnectionString = mailerConfiguration.azure.connectionString;
    if (azureConnectionString) {
      try {
        this.azureClient = new EmailClient(azureConnectionString);
        this.logger.log('✅ Azure Email Client initialized successfully');
      } catch (error) {
        this.azureClient = null;
        this.logger.warn('⚠️  Failed to initialize Azure Email Client', error);
      }
    } else {
      this.azureClient = null;
      this.logger.warn('⚠️  Azure Connection String not provided');
    }

    // Check if at least one provider is configured
    if (!this.awsSesTransporter && !this.resendClient && !this.azureClient) {
      throw new Error('❌ No email provider configured. Please set up AWS SES, Resend, or Azure.');
    }

    const provider = mailerConfiguration.useAwsFirst ? 'AWS SES → Resend' : 'Resend only';
    this.logger.log(`� Email provider: ${provider}`);
  }

  public async sendEmail(
    sendEmailDto: SendEmailDto,
  ): Promise<{ success: boolean; messageId?: string } | null> {
    const { recipients } = sendEmailDto;

    if (!recipients || recipients.length === 0) {
      this.logger.error('No recipients provided');
      return null;
    }

    // Always fallback, just decide which to try first
    if (this.mailerConfiguration.useAwsFirst) {
      // Try AWS SES first, fallback to Resend
      const result = await this.sendWithAwsSes(sendEmailDto);
      if (result) {
        return result;
      }
      this.logger.warn('🔄 AWS SES failed, falling back to Resend...');
      return await this.sendWithResend(sendEmailDto);
    } else {
      // Use Resend only (skip AWS SES)
      this.logger.log('⚡ EMAIL_USE_AWS_FIRST=false - using Resend only');
      return await this.sendWithResend(sendEmailDto);
    }
  }

  private async sendWithAwsSes(
    sendEmailDto: SendEmailDto,
  ): Promise<{ success: boolean; messageId?: string } | null> {
    if (!this.awsSesTransporter) {
      this.logger.error('❌ AWS SES client not initialized');
      return null;
    }

    const { recipients } = sendEmailDto;

    // Convert recipients to email addresses
    const toRecipients = recipients.map((recipient) => {
      if (typeof recipient === 'string') {
        return recipient;
      }
      return recipient.email;
    });

    try {
      this.logger.log(
        `📧 [AWS SES] Sending email from: ${this.mailerConfiguration.awsSes.fromEmail}`,
      );
      this.logger.log(`📧 [AWS SES] Recipients: ${toRecipients.join(', ')}`);

      const info = await this.awsSesTransporter.sendMail({
        from: this.mailerConfiguration.awsSes.fromEmail,
        to: toRecipients,
        subject: sendEmailDto.subject,
        html: sendEmailDto.html || '',
        text: sendEmailDto.text || '',
      });

      this.logger.log(`✅ [AWS SES] Email sent successfully. Message ID: ${info.messageId}`);
      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      this.logger.error(`❌ [AWS SES] Failed to send email: ${error.message || 'Unknown error'}`);
      return null;
    }
  }

  private async sendWithResend(
    sendEmailDto: SendEmailDto,
  ): Promise<{ success: boolean; messageId?: string } | null> {
    if (!this.resendClient) {
      this.logger.error('❌ Resend client not initialized');
      return null;
    }

    const { recipients } = sendEmailDto;

    // Convert recipients to email addresses
    const toRecipients = recipients.map((recipient) => {
      if (typeof recipient === 'string') {
        return recipient;
      }
      return recipient.email;
    });

    try {
      this.logger.log(
        `📧 [RESEND] Sending email from: ${this.mailerConfiguration.resend.fromEmail}`,
      );
      this.logger.log(`📧 [RESEND] Recipients: ${toRecipients.join(', ')}`);

      const response = await this.resendClient.emails.send({
        from: this.mailerConfiguration.resend.fromEmail,
        to: toRecipients,
        subject: sendEmailDto.subject,
        html: sendEmailDto.html || '',
        text: sendEmailDto.text || '',
      });

      if (response.error) {
        this.logger.error(`❌ [RESEND] Email send failed: ${response.error.message}`);
        return null;
      }

      this.logger.log(`✅ [RESEND] Email sent successfully. Message ID: ${response.data?.id}`);
      return {
        success: true,
        messageId: response.data?.id,
      };
    } catch (error) {
      this.logger.error(`❌ [RESEND] Failed to send email: ${error.message || 'Unknown error'}`);
      return null;
    }
  }

  private async sendWithAzure(
    sendEmailDto: SendEmailDto,
  ): Promise<{ success: boolean; messageId?: string } | null> {
    if (!this.azureClient) {
      this.logger.error('❌ Azure client not initialized');
      return null;
    }

    const { recipients, subject, html, text } = sendEmailDto;

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
      this.logger.log(`📧 [AZURE] Sending email from: ${this.mailerConfiguration.azure.fromEmail}`);
      const recipientEmails = recipients.map((r) => (typeof r === 'string' ? r : r.email));
      this.logger.log(`📧 [AZURE] Recipients: ${recipientEmails.join(', ')}`);

      const poller = await this.azureClient.beginSend(message);
      const response = await poller.pollUntilDone();

      if (response.status === KnownEmailSendStatus.Succeeded) {
        this.logger.log(`✅ [AZURE] Email sent successfully. Message ID: ${response.id}`);
        return {
          success: true,
          messageId: response.id,
        };
      } else {
        this.logger.error(`❌ [AZURE] Email send failed with status: ${response.status}`);
        return null;
      }
    } catch (error) {
      this.logger.error(`❌ [AZURE] Failed to send email: ${error.message || 'Unknown error'}`);
      this.logger.error(`❌ [AZURE] Error code: ${error.code || 'N/A'}`);
      this.logger.error(`❌ [AZURE] Status code: ${error.statusCode || 'N/A'}`);
      return null;
    }
  }

  public renderTemplate(path: string, variables: Record<string, string>): string {
    const templatePath = join(process.cwd(), 'src', 'email', 'templates', path);

    try {
      let template = readFileSync(templatePath, 'utf-8');
      for (const key of Object.keys(variables)) {
        template = template.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), variables[key]);
      }

      return template;
    } catch (error) {
      this.logger.error(`Error reading template: ${path}`, error);
      throw error;
    }
  }
}
