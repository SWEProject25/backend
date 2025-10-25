import {
  ConflictException,
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { PrismaService } from '../prisma/prisma.service';
import { RemoveMessageDto } from './dto/remove-message.dto';

@Injectable()
export class MessagesService {
  constructor(private readonly prismaService: PrismaService) {}

  async create(createMessageDto: CreateMessageDto) {
    const { conversationId, senderId, text } = createMessageDto;
    console.log('Creating message with data:', createMessageDto);

    // Ensure the conversation exists
    const conversation = await this.prismaService.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Create and return the message
    return this.prismaService.message.create({
      data: {
        text,
        senderId,
        conversationId,
      },
      select: {
        id: true,
        senderId: true,
        text: true,
        createdAt: true,
      },
    });
  }

  async isUserInConversation(createMessageDto: CreateMessageDto): Promise<boolean> {
    const { conversationId, senderId: userId } = createMessageDto;
    console.log('Checking if user is in conversation:', { conversationId, userId });
    const conversation = await this.prismaService.conversation.findUnique({
      where: { id: conversationId },
      select: { user1Id: true, user2Id: true },
    });

    if (!conversation) {
      console.log('Conversation not found');
      return false;
    }
    console.log('Conversation found:', conversation);

    return conversation.user1Id === userId || conversation.user2Id === userId;
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
      data: messages.reverse(), // Return oldest first for chat display
      metadata: {
        totalItems: total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async update(updateMessageDto: UpdateMessageDto) {
    const { id, text } = updateMessageDto;

    // Check if message exists
    const message = await this.prismaService.message.findUnique({
      where: { id },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Update and return the message
    return this.prismaService.message.update({
      where: { id },
      data: { text, updatedAt: new Date() },
    });
  }

  async remove(removeMessageDto: RemoveMessageDto) {
    const { userId, conversationId, messageId } = removeMessageDto;
    return this.prismaService.$transaction(async (prisma) => {
      // First get the conversation to determine if user is user1 or user2
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { user1Id: true, user2Id: true },
      });

      if (!conversation) {
        throw new NotFoundException('Conversation not found');
      }

      // Check if the user is part of the conversation
      if (conversation.user1Id !== userId && conversation.user2Id !== userId) {
        throw new ForbiddenException('You are not part of this conversation');
      }

      // Check if message exists and belongs to this conversation
      const message = await prisma.message.findFirst({
        where: {
          id: messageId,
          conversationId: conversationId,
        },
      });

      if (!message) {
        throw new NotFoundException('Message not found');
      }

      const isUser1 = userId === conversation.user1Id;
      const deletedField = isUser1 ? 'isDeletedU1' : 'isDeletedU2';

      // Mark the message as deleted for the user
      await prisma.message.update({
        where: {
          id: messageId,
        },
        data: {
          [deletedField]: true,
        },
      });
    });
  }
}
