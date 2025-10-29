import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { Services } from 'src/utils/constants';

@Module({
  providers: [StorageService,
    {
      provide: Services.STORAGE,
      useClass: StorageService,
    },
  ]
})
export class StorageModule { }
