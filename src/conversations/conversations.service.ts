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

  async create(createConversationDto: CreateConversationDto, currentUserId: number) {
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
    const isUser1 = currentUserId === user1Id;
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
            createdAt: 'desc',
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

      return {
        data: {
          ...conversationData,
          messages: Messages.reverse(), // Reverse to show oldest first
        },
        metadata: {
          totalItems: totalMessages,
          page: 1,
          limit: 20,
          totalPages: Math.ceil(totalMessages / 20),
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
        page: 1,
        limit: 20,
        totalPages: 0,
      },
    };
  }

  async getConversationsForUser(userId: number) {
    const conversations = await this.prismaService.conversation.findMany({
      where: {
        OR: [{ user1Id: userId }, { user2Id: userId }],
      },
      include: {
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
    });

    // Transform Messages to messages and filter based on user
    return conversations.map(({ Messages, User1, User2, ...conversation }) => {
      const isUser1 = userId === conversation.user1Id;

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
        user1: {
          id: User1.id,
          username: User1.username,
          profile_image_url: User1.Profile?.profile_image_url ?? null,
          displayName: User1.Profile?.name ?? null,
        },
        user2: {
          id: User2.id,
          username: User2.username,
          profile_image_url: User2.Profile?.profile_image_url ?? null,
          displayName: User2.Profile?.name ?? null,
        },
      };
    });
  }

  async getConversationMessages(
    conversationId: number,
    currentUserId: number,
    page: number = 1,
    limit: number = 20,
  ) {
    const skip = (page - 1) * limit;

    // First get the conversation to determine if user is user1 or user2
    const conversation = await this.prismaService.conversation.findUnique({
      where: { id: conversationId },
      select: { user1Id: true, user2Id: true },
    });

    if (!conversation) {
      throw new ConflictException('Conversation not found');
    }

    const isUser1 = currentUserId === conversation.user1Id;
    const deletedField = isUser1 ? 'isDeletedU1' : 'isDeletedU2';

    const [messages, total] = await Promise.all([
      this.prismaService.message.findMany({
        where: {
          conversationId,
          [deletedField]: false,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
        select: {
          id: true,
          text: true,
          senderId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prismaService.message.count({
        where: {
          conversationId,
          [deletedField]: false,
        },
      }),
    ]);

    return {
      messages: messages.reverse(), // Return oldest first for chat display
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
