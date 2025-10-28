import { Module } from '@nestjs/common';
import { PostController } from './post.controller';
import { PostService } from './services/post.service';
import { Services } from 'src/utils/constants';
import { PrismaService } from 'src/prisma/prisma.service';
import { LikeService } from './services/like.service';
import { RepostService } from './services/repost.service';
import { MentionService } from './services/mention.service';
import { StorageService } from 'src/storage/storage.service';

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
    {
      provide: Services.LIKE,
      useClass: LikeService,
    },
    {
      provide: Services.REPOST,
      useClass: RepostService,
    },
    {
      provide: Services.MENTION,
      useClass: MentionService,
    },
    {
      provide: Services.STORAGE,
      useClass: StorageService,
    },
  ],
})
export class PostModule {}
