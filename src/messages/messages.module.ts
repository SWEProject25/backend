import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesGateway } from './messages.gateway';
import { MessagesController } from './messages.controller';
import { PrismaService } from '../prisma/prisma.service';
import { Services } from 'src/utils/constants';

@Module({
  controllers: [MessagesController],
  providers: [
    MessagesGateway,
    PrismaService,
    {
      provide: Services.PRISMA,
      useClass: PrismaService,
    },
    {
      provide: Services.MESSAGES,
      useClass: MessagesService,
    },
  ],
})
export class MessagesModule {}
