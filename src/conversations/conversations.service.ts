import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Services } from 'src/utils/constants';

@Injectable()
export class ConversationsService {
  constructor(
    @Inject(Services.PRISMA)
    private readonly prismaService: PrismaService,
  ) {}

  async create(createConversationDto: CreateConversationDto) {
    // Ensure user1Id is always less than user2Id to maintain uniqueness {1,2} == {2,1}
    const { user1Id, user2Id } =
      createConversationDto.user1Id < createConversationDto.user2Id
        ? {
            user1Id: createConversationDto.user1Id,
            user2Id: createConversationDto.user2Id,
          }
        : {
            user1Id: createConversationDto.user2Id,
            user2Id: createConversationDto.user1Id,
          };

    if (user1Id === user2Id) {
      throw new ConflictException('A user cannot create a conversation with themselves');
    }

    // Determine if current user is user1 or user2
    const isUser1 = createConversationDto.user1Id === user1Id;
    const deletedField = isUser1 ? 'isDeletedU1' : 'isDeletedU2';

    const oldConversation = await this.prismaService.conversation.findFirst({
      where: {
        user1Id,
        user2Id,
      },
      include: {
        Messages: {
          where: {
            [deletedField]: false,
          },
          orderBy: {
            id: 'desc',
          },
          take: 20,
          select: {
            id: true,
            text: true,
            senderId: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (oldConversation) {
      const totalMessages = await this.prismaService.message.count({
        where: {
          conversationId: oldConversation.id,
          [deletedField]: false,
        },
      });

      const { Messages, ...conversationData } = oldConversation;
      const reversedMessages = Messages.reverse(); // Reverse to show oldest first

      return {
        data: {
          ...conversationData,
          messages: reversedMessages,
        },
        metadata: {
          totalItems: totalMessages,
          limit: 20,
          hasMore: Messages.length === 20,
          lastMessageId: reversedMessages.length > 0 ? reversedMessages[0].id : null,
        },
      };
    }

    const newConversation = await this.prismaService.conversation.create({
      data: {
        user1Id,
        user2Id,
      },
      include: {
        Messages: true,
      },
    });

    const { Messages, ...conversationData } = newConversation;

    return {
      data: {
        ...conversationData,
        messages: Messages,
      },
      metadata: {
        totalItems: 0,
        limit: 20,
        hasMore: false,
        lastMessageId: null,
        newestMessageId: null,
      },
    };
  }

  async getConversationsForUser(userId: number, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [conversations, total] = await this.prismaService.$transaction([
      this.prismaService.conversation.findMany({
        where: {
          OR: [{ user1Id: userId }, { user2Id: userId }],
        },
        select: {
          id: true,
          updatedAt: true,
          createdAt: true,
          User1: {
            select: {
              id: true,
              username: true,
              Profile: {
                select: {
                  name: true,
                  profile_image_url: true,
                },
              },
            },
          },
          User2: {
            select: {
              id: true,
              username: true,
              Profile: {
                select: {
                  name: true,
                  profile_image_url: true,
                },
              },
            },
          },
          Messages: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 10, // Take more messages to find a visible one
            select: {
              id: true,
              text: true,
              senderId: true,
              createdAt: true,
              updatedAt: true,
              isDeletedU1: true,
              isDeletedU2: true,
            },
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prismaService.conversation.count({
        where: {
          OR: [{ user1Id: userId }, { user2Id: userId }],
        },
      }),
    ]);

    // Transform Messages to messages and filter based on user
    const transformedConversations = conversations.map(
      ({ Messages, User1, User2, ...conversation }) => {
        const isUser1 = userId === User1.id;

        // Find the first message that's not deleted for this user
        const lastVisibleMessage = Messages.find((msg) =>
          isUser1 ? !msg.isDeletedU1 : !msg.isDeletedU2,
        );

        return {
          ...conversation,
          lastMessage: lastVisibleMessage
            ? {
                id: lastVisibleMessage.id,
                text: lastVisibleMessage.text,
                senderId: lastVisibleMessage.senderId,
                createdAt: lastVisibleMessage.createdAt,
                updatedAt: lastVisibleMessage.updatedAt,
              }
            : null,
          user:
            userId === User1.id
              ? {
                  id: User2.id,
                  username: User2.username,
                  profile_image_url: User2.Profile?.profile_image_url ?? null,
                  displayName: User2.Profile?.name ?? null,
                }
              : {
                  id: User1.id,
                  username: User1.username,
                  profile_image_url: User1.Profile?.profile_image_url ?? null,
                  displayName: User1.Profile?.name ?? null,
                },
        };
      },
    );

    return {
      data: transformedConversations,
      metadata: {
        totalItems: total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUnseenConversationsCount(userId: number) {
    // Get all conversations for the user
    const conversations = await this.prismaService.conversation.findMany({
      where: {
        OR: [{ user1Id: userId }, { user2Id: userId }],
      },
      select: {
        id: true,
        user1Id: true,
        user2Id: true,
        Messages: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
          select: {
            senderId: true,
            isSeen: true,
          },
        },
      },
    });

    // Count conversations where last message is unseen and sent by other user
    const unseenCount = conversations.filter((conv) => {
      const lastMessage = conv.Messages[0];
      if (!lastMessage) return false;

      // Skip if current user sent the last message
      if (lastMessage.senderId === userId) return false;

      // Count if not seen
      return !lastMessage.isSeen;
    });

    return unseenCount.length;
  }
}
