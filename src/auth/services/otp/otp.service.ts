import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { generateOtp } from 'src/utils/otp.util';
import { hash, verify } from 'argon2';

@Injectable()
export class OtpService {
  private readonly minRequestIntervalMinutes = 1;
  private readonly tokenExpirationMinutes = 15;

  constructor(private readonly prismaService: PrismaService) {}

  async generate(email: string, size = 6): Promise<string> {
    await this.checkRateLimit(email);

    const otp = generateOtp(size);
    const hashedToken = await hash(otp);

    await this.prismaService.emailVerification.create({
      data: {
        user_email: email,
        token: hashedToken,
        expires_at: new Date(
          Date.now() + this.tokenExpirationMinutes * 60 * 1000,
        ),
      },
    });

    return otp;
  }

  async validate(email: string, token: string): Promise<boolean> {
    const validToken = await this.prismaService.emailVerification.findFirst({
      where: {
        user_email: email,
        expires_at: { gt: new Date() },
      },
    });

    if (!validToken) {
      return false;
    }

    const isValid = await verify(validToken.token, token);

    if (isValid) {
      await this.prismaService.emailVerification.delete({
        where: { id: validToken.id },
      });
    }

    return isValid;
  }

  async deleteExisting(email: string): Promise<void> {
    await this.prismaService.emailVerification.deleteMany({
      where: { user_email: email },
    });
  }

  private async checkRateLimit(email: string): Promise<void> {
    const recentToken = await this.prismaService.emailVerification.findFirst({
      where: {
        user_email: email,
        created_at: {
          gt: new Date(Date.now() - this.minRequestIntervalMinutes * 60 * 1000),
        },
      },
    });

    if (recentToken) {
      throw new UnprocessableEntityException(
        'Please wait a minute before requesting a new token.',
      );
    }
  }
}
