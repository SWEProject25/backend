import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { createTransport, SendMailOptions, Transporter } from 'nodemailer';
import mailerConfig from './../common/config/mailer.config';
import { SendEmailDto } from './dto/send-email.dto';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as SendGrid from '@sendgrid/mail';
import { MailDataRequired } from '@sendgrid/mail';

@Injectable()
export class EmailService {
  private readonly mailTransport: Transporter;

  constructor(
    @Inject(mailerConfig.KEY)
    private readonly mailerConfiguration: ConfigType<typeof mailerConfig>,
  ) {
    SendGrid.setApiKey(process.env.SENDGRID_API_KEY!);
    // console.log(process.env.SENDGRID_API_KEY);
    // this.mailTransport = createTransport({
    //   host: this.mailerConfiguration.transport.host,
    //   port: this.mailerConfiguration.transport.port,
    //   secure: this.mailerConfiguration.transport.secure,
    //   auth: this.mailerConfiguration.transport.auth,
    // });
  }

  public async sendEmail(data: SendEmailDto): Promise<{ success: boolean } | null> {
    const { recipients, subject, html, text } = data;

    const mailOptions: MailDataRequired = {
      from: { name: 'Hankers', email: process.env.SENDGRID_FROM_EMAIL! },
      to: recipients,
      subject,
      html,
      text,
    };

    // try {
    //   await this.mailTransport.sendMail(mailOptions);
    //   return { success: true };
    // } catch (error) {
    //   // handle error
    //   console.error(error);
    //   return null;
    // }
    try {
      await SendGrid.send(mailOptions);
      return { success: true };
    } catch (error) {
      console.error('Error sending email:', error);
      throw new Error('Failed to send email');
    }
  }
  public renderTemplate(otp: string, path: string): string {
    const templatePath = join(process.cwd(), 'src', 'email', 'templates', path);

    const template = readFileSync(templatePath, 'utf-8');
    return template.replace('{{verificationCode}}', otp);
  }
}
