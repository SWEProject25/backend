import { Module } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';
import { Services } from 'src/utils/constants';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  controllers: [ConversationsController],
  providers: [
    {
      provide: Services.CONVERSATIONS,
      useClass: ConversationsService,
    },
  ],
  imports: [PrismaModule],
})
export class ConversationsModule {}
