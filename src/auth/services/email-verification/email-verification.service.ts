import {
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EmailService } from 'src/email/email.service';
import { UserService } from 'src/user/user.service';
import { OtpService } from './../otp/otp.service';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Services } from 'src/utils/constants';

@Injectable()
export class EmailVerificationService {
  constructor(
    @Inject(Services.EMAIL)
    private readonly emailService: EmailService,
    @Inject(Services.USER)
    private readonly userService: UserService,
    @Inject(Services.OTP)
    private readonly otpService: OtpService,
  ) {}

  async sendVerificationEmail(email: string): Promise<void> {
    const user = await this.userService.findByEmail(email);

    if (user?.is_verified) {
      throw new UnprocessableEntityException('Account already verified');
    }

    const otp = await this.otpService.generate(email);
    const html = this.renderTemplate(otp, 'email-verification.html');

    await this.emailService.sendEmail({
      subject: 'Account Verification',
      recipients: [email],
      html,
    });
  }

  async resendVerificationEmail(email: string): Promise<void> {
    const existingOtp = await this.userService.checkExistingOtp(email);

    if (existingOtp) {
      await this.otpService.deleteExisting(email);
    }

    await this.sendVerificationEmail(email);
  }

  async verifyEmail(email: string, otp: string): Promise<boolean> {
    const user = await this.userService.findByEmail(email);

    if (user?.is_verified) {
      throw new UnprocessableEntityException('Account already verified');
    }

    const isValid = await this.otpService.validate(email, otp);

    if (!isValid) {
      throw new UnprocessableEntityException('Invalid or expired OTP');
    }

    return true;
  }

  private renderTemplate(otp: string, path: string): string {
    const templatePath = join(process.cwd(), 'src', 'email', 'templates', path);

    const template = readFileSync(templatePath, 'utf-8');
    return template.replace('{{verificationCode}}', otp);
  }
}
