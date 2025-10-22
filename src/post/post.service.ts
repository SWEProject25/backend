import { Inject, Injectable } from '@nestjs/common';
import { PostVisibility } from 'generated/prisma';
import { PrismaService } from 'src/prisma/prisma.service';
import { Services } from 'src/utils/constants';
import { CreatePostDto } from './dto/create-post.dto';

@Injectable()
export class PostService {

  constructor(
    @Inject(Services.PRISMA)
    private readonly prismaService: PrismaService,
  ) { }

  async createPost(createPostDto: CreatePostDto){
    const { content, type, parentId, visibility, userId } = createPostDto;

    return this.prismaService.post.create({
      data: {
        content,
        type,
        parentId,
        visibility,
        userId,
      },
    });
  }
}
