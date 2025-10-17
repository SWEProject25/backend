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

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    PrismaService,
    LocalStrategy,
    JwtStrategy,
    EmailService,
    PasswordService,
    EmailVerificationService,
    JwtTokenService,
    OtpService,
  ],
  imports: [
    UserModule,
    PassportModule,
    ConfigModule.forFeature(jwtConfig),
    JwtModule.registerAsync(jwtConfig.asProvider()),
    ConfigModule.forFeature(mailerConfig),
  ],
  exports: [AuthService],
})
export class AuthModule {}
