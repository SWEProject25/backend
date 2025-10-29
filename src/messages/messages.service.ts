import {
  ConflictException,
  Injectable,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
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
        conversationId: true,
        senderId: true,
        text: true,
        createdAt: true,
      },
    });
  }

  async getConversationUsers(
    conversationId: number,
  ): Promise<{ user1Id: number; user2Id: number }> {
    const conversation = await this.prismaService.conversation.findUnique({
      where: { id: conversationId },
      select: { user1Id: true, user2Id: true },
    });

    if (!conversation) {
      console.error('Conversation not found');
      return { user1Id: 0, user2Id: 0 };
    }

    return { user1Id: conversation.user1Id, user2Id: conversation.user2Id };
  }

  async isUserInConversation(createMessageDto: CreateMessageDto): Promise<boolean> {
    const { conversationId, senderId } = createMessageDto;

    const conversation = await this.prismaService.conversation.findUnique({
      where: { id: conversationId },
      select: { user1Id: true, user2Id: true },
    });

    if (!conversation) {
      console.error('Conversation not found');
      return false;
    }

    return senderId === conversation.user1Id || senderId === conversation.user2Id;
  }

  async getConversationMessages(
    conversationId: number,
    currentUserId: number,
    lastMessageId?: number,
    limit: number = 20,
  ) {
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

    // Build the where clause with cursor-based pagination
    const whereClause: any = {
      conversationId,
      [deletedField]: false,
    };

    // If lastMessageId is provided, fetch messages older than that message
    if (lastMessageId) {
      whereClause.id = {
        lt: lastMessageId, // Less than - for loading older messages
      };
    }

    const [messages, total] = await Promise.all([
      this.prismaService.message.findMany({
        where: whereClause,
        orderBy: {
          id: 'desc', // Order by id descending to get older messages first
        },
        take: limit,
        select: {
          id: true,
          text: true,
          senderId: true,
          isSeen: true,
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

    const reversedMessages = messages.reverse(); // Return oldest first for chat display

    return {
      data: reversedMessages,
      metadata: {
        totalItems: total,
        limit,
        hasMore: messages.length === limit,
        lastMessageId: reversedMessages.length > 0 ? reversedMessages[0].id : null,
      },
    };
  }

  async update(updateMessageDto: UpdateMessageDto, senderId: number) {
    const { id, text } = updateMessageDto;

    // Check if message exists
    const message = await this.prismaService.message.findUnique({
      where: { id },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.senderId !== senderId) {
      throw new UnauthorizedException('You are not the owner of this message');
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

  async markMessagesAsSeen(conversationId: number, userId: number) {
    // Get the conversation to verify user is a participant
    const conversation = await this.prismaService.conversation.findUnique({
      where: { id: conversationId },
      select: { user1Id: true, user2Id: true },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Verify user is part of the conversation
    if (conversation.user1Id !== userId && conversation.user2Id !== userId) {
      throw new ForbiddenException('You are not part of this conversation');
    }

    // Mark all unseen messages sent by the other user as seen
    const result = await this.prismaService.message.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        isSeen: false,
      },
      data: {
        isSeen: true,
      },
    });

    return result;
  }

  async getUnseenMessagesCount(conversationId: number, userId: number) {
    const count = await this.prismaService.message.count({
      where: {
        conversationId,
        senderId: { not: userId },
        isSeen: false,
      },
    });

    return count;
  }
}
