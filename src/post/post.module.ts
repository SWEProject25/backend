import { Module } from '@nestjs/common';
import { PostController } from './post.controller';
import { PostService } from './post.service';
import { Services } from 'src/utils/constants';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [PostController],
  providers: [
    PostService,
    {
      provide: Services.PRISMA,
      useClass: PrismaService,
    },
    {
      provide: Services.POST,
      useClass: PostService,
    },
  ],
})
export class PostModule { }
