import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { Services } from "src/utils/constants";

@Injectable()
export class RepostService {

  constructor(
    @Inject(Services.PRISMA)
    private readonly prismaService: PrismaService,
  ) { }

  async toggleRepost(postId: number, userId: number) {
    return this.prismaService.$transaction(async (tx) => {

      const repost = await tx.repost.findUnique({
        where: { post_id_user_id: { post_id: postId, user_id: userId } },
      });

      if (repost) {
        await tx.repost.delete({
          where: { post_id_user_id: { post_id: postId, user_id: userId } },
        });

        return { message: 'Repost removed' };
      } else {
        await tx.repost.create({
          data: { post_id: postId, user_id: userId },
        });

        return { message: 'Post reposted' };
      }
    })
  }

  async getReposters(postId: number, page: number, limit: number) {
    return this.prismaService.repost.findMany({
      where:{
        post_id: postId,
      },
      select: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            is_verified: true
          },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
    });

  }
}