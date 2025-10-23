import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { PrismaService } from './prisma/prisma.service';
import { UserModule } from './user/user.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/guards/jwt-auth/jwt-auth.guard';
import { EmailModule } from './email/email.module';
import { Services } from './utils/constants';
import { GoogleRecaptchaModule } from '@nestlab/google-recaptcha';
import { Request } from 'express';
import { PostModule } from './post/post.module';
import { UsersModule } from './users/users.module';

const envFilePath = '.env';

@Module({
  imports: [
    ConfigModule.forRoot({ envFilePath, isGlobal: true }),
    AuthModule,
    UserModule,
    UsersModule,
    EmailModule,
    GoogleRecaptchaModule.forRoot({
      secretKey: process.env.GOOGLE_RECAPTCHA_SECRET_KEY_V2,
      response: (req: Request) => req?.body.recaptcha, // Extract token from the request body
      // for v3
      // score: 0.8, // The minimum score to pass
      // for v2
      // skipIf: process.env.NODE_ENV !== 'production',
    }),
    PostModule,
  ],
  controllers: [],
  providers: [
    {
      provide: Services.PRISMA,
      useClass: PrismaService,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
