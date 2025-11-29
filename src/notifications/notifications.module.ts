import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationListener } from './events/notification.listener';
import { Services } from 'src/utils/constants';
import { PrismaModule } from 'src/prisma/prisma.module';
import { FirebaseModule } from 'src/firebase/firebase.module';

@Module({
  imports: [PrismaModule, FirebaseModule],
  providers: [
    NotificationService,
    {
      provide: Services.NOTIFICATION,
      useClass: NotificationService,
    },
    NotificationListener,
  ],
  exports: [NotificationService, Services.NOTIFICATION],
})
export class NotificationsModule {}
