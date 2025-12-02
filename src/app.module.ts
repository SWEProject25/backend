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
import { RedisService } from './redis/redis.service';
import { PostModule } from './post/post.module';
import { UsersModule } from './users/users.module';
import { ProfileModule } from './profile/profile.module';
import { StorageModule } from './storage/storage.module';
import { RedisModule } from './redis/redis.module';
import { MessagesModule } from './messages/messages.module';
import { ConversationsModule } from './conversations/conversations.module';
import { PrismaModule } from './prisma/prisma.module';
import { AiIntegrationModule } from './ai-integration/ai-integration.module';
import envSchema from './config/validate-config';
import { BullModule } from '@nestjs/bullmq';
import redisConfig from './config/redis.config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { FirebaseModule } from './firebase/firebase.module';
import { NotificationsModule } from './notifications/notifications.module';

const envFilePath = '.env';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath,
      isGlobal: true,
      validationSchema: envSchema,
      load: [redisConfig],
    }),
    EventEmitterModule.forRoot(),
    FirebaseModule,
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
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [redisConfig.KEY],
      useFactory: (config: { redisHost: string; redisPort: number }) => {
        console.log('BullMQ connecting to Redis at:', `${config.redisHost}:${config.redisPort}`);

        return {
          connection: {
            host: config.redisHost,
            port: config.redisPort,
          },

          defaultJobOptions: {
            removeOnComplete: {
              count: 1000,
              age: 24 * 3600, // 1 day
            },
            removeOnFail: {
              count: 5000,
              age: 7 * 24 * 3600, // 7 days
            },
          },
        };
      },
    }),
    PostModule,
    ProfileModule,
    StorageModule,
    RedisModule,
    MessagesModule,
    ConversationsModule,
    PrismaModule,
    AiIntegrationModule,
    NotificationsModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
