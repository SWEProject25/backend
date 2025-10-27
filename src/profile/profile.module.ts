import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { Services } from 'src/utils/constants';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  controllers: [ProfileController],
  providers: [
    {
      provide: Services.PROFILE,
      useClass: ProfileService,
    },
  ],
  exports: [
    {
      provide: Services.PROFILE,
      useClass: ProfileService,
    },
  ],
  imports: [PrismaModule],
})
export class ProfileModule {}
