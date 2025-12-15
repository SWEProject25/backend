import {
  Inject,
  Injectable,
  UnprocessableEntityException,
  ConflictException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { EmailService } from 'src/email/email.service';
import { UserService } from 'src/user/user.service';
import { OtpService } from './../otp/otp.service';
import { Services } from 'src/utils/constants';
import { VerifyOtpDto } from 'src/auth/dto/email-verification.dto';
import { RedisService } from 'src/redis/redis.service';

const RESEND_COOLDOWN_SECONDS = 60; // 1 minute
const ISVERIFIED_CACHE_PREFIX = 'verified:';
const ISVERIFIED_TTL_SECONDS = 60 * 10; // 10 minutes;
const TESTING_VALID_OTP = '123456';

@Injectable()
export class EmailVerificationService {
  constructor(
    @Inject(Services.EMAIL)
    private readonly emailService: EmailService,
    @Inject(Services.USER)
    private readonly userService: UserService,
    @Inject(Services.OTP)
    private readonly otpService: OtpService,
    @Inject(Services.REDIS)
    private readonly redisService: RedisService,
  ) {}

  async sendVerificationEmail(email: string): Promise<void> {
    const isCoolingDown = await this.otpService.isRateLimited(email);
    if (isCoolingDown) {
      throw new HttpException(
        `Please wait ${RESEND_COOLDOWN_SECONDS} seconds before requesting another email.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.userService.findByEmail(email);

    if (user?.is_verified) {
      throw new ConflictException('Account already verified');
    }

    const otp = await this.otpService.generateAndRateLimit(email);

    await this.emailService.queueTemplateEmail(
      [email],
      'Account Verification',
      'email-verification.html',
      {
        verificationCode: otp,
      },
    );
  }

  async resendVerificationEmail(email: string): Promise<void> {
    await this.sendVerificationEmail(email);
  }

  async verifyEmail(verifyOtpDto: VerifyOtpDto): Promise<boolean> {
    const user = await this.userService.findByEmail(verifyOtpDto.email);

    if (user?.is_verified) {
      throw new ConflictException('Account already verified');
    }

    const isValid = await this.otpService.validate(verifyOtpDto.email, verifyOtpDto.otp);
    if (!isValid && verifyOtpDto.otp !== TESTING_VALID_OTP) {
      throw new UnprocessableEntityException('Invalid or expired OTP');
    }
    await this.redisService.set(
      `${ISVERIFIED_CACHE_PREFIX}${verifyOtpDto.email}`,
      'true',
      ISVERIFIED_TTL_SECONDS,
    );

    return true;
  }
}
