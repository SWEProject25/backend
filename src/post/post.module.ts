import { Module } from '@nestjs/common';
import { PostController } from './post.controller';
import { PostService } from './services/post.service';
import { Services } from 'src/utils/constants';
import { LikeService } from './services/like.service';
import { RepostService } from './services/repost.service';
import { MentionService } from './services/mention.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { StorageService } from 'src/storage/storage.service';
import { HttpModule } from '@nestjs/axios';
import { MLService } from './services/ml.service';

@Module({
  controllers: [PostController],
  providers: [
    PostService,
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

    MLService,
  ],
  imports: [PrismaModule, HttpModule],
})
export class PostModule {}
