import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { Services } from 'src/utils/constants';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [ProfileController],
  providers: [
    {
      provide: Services.PROFILE,
      useClass: ProfileService,
    },
    {
      provide: Services.PRISMA,
      useClass: PrismaService,
    },
  ],
  exports: [Services.PROFILE],
})
export class ProfileModule {}
