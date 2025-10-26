import {
  Inject,
  Injectable,
  UnprocessableEntityException,
  ConflictException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { EmailService } from 'src/email/email.service';
import { UserService } from 'src/user/user.service';
import { OtpService } from './../otp/otp.service';
import { Services } from 'src/utils/constants';
import { VerifyOtpDto } from 'src/auth/dto/email-verification.dto';

const RESEND_COOLDOWN_SECONDS = 60; // 1 minute

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

    // if (!user) {
    //   throw new NotFoundException('User not found');
    // }

    if (user?.is_verified) {
      throw new ConflictException('Account already verified');
    }

    const isCoolingDown = await this.otpService.isRateLimited(email);
    if (isCoolingDown) {
      throw new HttpException(
        `Please wait ${RESEND_COOLDOWN_SECONDS} seconds before requesting another email.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const otp = await this.otpService.generateAndRateLimit(email);

    const html = this.emailService.renderTemplate(otp, 'email-verification.html');
    await this.emailService.sendEmail({
      subject: 'Account Verification',
      recipients: [email],
      html,
    });
  }

  async resendVerificationEmail(email: string): Promise<void> {
    await this.sendVerificationEmail(email);
  }

  async verifyEmail(verifyOtpDto: VerifyOtpDto): Promise<boolean> {
    const user = await this.userService.findByEmail(verifyOtpDto.email);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.is_verified) {
      throw new ConflictException('Account already verified');
    }

    const isValid = await this.otpService.validate(verifyOtpDto.email, verifyOtpDto.otp);
    if (!isValid) {
      throw new UnprocessableEntityException('Invalid or expired OTP');
    }

    // await this.userService.update(user.id, { is_verified: true });
    return true;
  }
}
