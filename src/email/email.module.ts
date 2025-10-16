import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { ConfigModule } from '@nestjs/config';
import { EmailController } from './email.controller';
import mailerConfig from 'src/common/config/mailer.config';

@Module({
  providers: [EmailService],
  exports: [EmailService],
  imports: [ConfigModule.forFeature(mailerConfig)],
  controllers: [EmailController],
})
export class EmailModule {}
