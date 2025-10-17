import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { createTransport, SendMailOptions, Transporter } from 'nodemailer';
import mailerConfig from './../common/config/mailer.config';
import { SendEmailDto } from './dto/send-email.dto';

@Injectable()
export class EmailService {
  private readonly mailTransport: Transporter;

  constructor(
    @Inject(mailerConfig.KEY)
    private readonly mailerConfiguration: ConfigType<typeof mailerConfig>,
  ) {
    this.mailTransport = createTransport({
      host: this.mailerConfiguration.transport.host,
      port: this.mailerConfiguration.transport.port,
      secure: this.mailerConfiguration.transport.secure,
      auth: this.mailerConfiguration.transport.auth,
    });
  }

  public async sendEmail(
    data: SendEmailDto,
  ): Promise<{ success: boolean } | null> {
    const { recipients, subject, html, text } = data;

    const mailOptions: SendMailOptions = {
      from: this.mailerConfiguration.transport.auth.user,
      to: recipients,
      subject,
      html,
      text,
    };

    try {
      await this.mailTransport.sendMail(mailOptions);
      return { success: true };
    } catch (error) {
      // handle error
      console.error(error);
      return null;
    }
  }
}
