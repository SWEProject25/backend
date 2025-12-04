import { Module, Global } from '@nestjs/common';
import { FirebaseService } from './firebase.service';
import { Services } from 'src/utils/constants';

@Global()
@Module({
  providers: [
    FirebaseService,
    {
      provide: Services.FIREBASE,
      useClass: FirebaseService,
    },
  ],
  exports: [FirebaseService, Services.FIREBASE],
})
export class FirebaseModule {}
