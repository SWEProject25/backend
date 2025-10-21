import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserModule } from 'src/user/user.module';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtModule } from '@nestjs/jwt';
import jwtConfig from './config/jwt.config';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';
import { ConfigModule } from '@nestjs/config';
import mailerConfig from 'src/common/config/mailer.config';
import { EmailService } from 'src/email/email.service';
import { PasswordService } from './services/password/password.service';
import { EmailVerificationService } from './services/email-verification/email-verification.service';
import { JwtTokenService } from './services/jwt-token/jwt-token.service';
import { OtpService } from './services/otp/otp.service';
import { Services } from 'src/utils/constants';
import { GoogleStrategy } from './strategies/google.strategy';
import googleOauthConfig from './config/google-oauth.config';

@Module({
  controllers: [AuthController],
  providers: [
    {
      provide: Services.AUTH,
      useClass: AuthService,
    },
    {
      provide: Services.PRISMA,
      useClass: PrismaService,
    },
    {
      provide: Services.EMAIL,
      useClass: EmailService,
    },
    {
      provide: Services.PASSWORD,
      useClass: PasswordService,
    },
    {
      provide: Services.EMAIL_VERIFICATION,
      useClass: EmailVerificationService,
    },
    {
      provide: Services.JWT_TOKEN,
      useClass: JwtTokenService,
    },
    {
      provide: Services.OTP,
      useClass: OtpService,
    },
    LocalStrategy,
    JwtStrategy,
    GoogleStrategy,
  ],
  imports: [
    UserModule,
    PassportModule,
    ConfigModule.forFeature(jwtConfig),
    JwtModule.registerAsync(jwtConfig.asProvider()),
    ConfigModule.forFeature(mailerConfig),
    ConfigModule.forFeature(googleOauthConfig),
  ],
  exports: [
    {
      provide: Services.AUTH,
      useClass: AuthService,
    },
  ],
})
export class AuthModule {}
