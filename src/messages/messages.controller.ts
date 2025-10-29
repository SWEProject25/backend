import {
  Controller,
  Get,
  Delete,
  Put,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth/jwt-auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from 'src/auth/interfaces/user.interface';
import { ErrorResponseDto } from 'src/common/dto/error-response.dto';
import { Services } from 'src/utils/constants';

@ApiTags('messages')
@Controller('messages')
export class MessagesController {
  constructor(
    @Inject(Services.MESSAGES)
    private readonly messagesService: MessagesService,
  ) {}

  @Get(':conversationId')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Get messages for a conversation',
    description: 'Retrieves paginated messages for a specific conversation',
  })
  @ApiParam({
    name: 'conversationId',
    type: Number,
    description: 'The ID of the conversation',
  })
  @ApiQuery({
    name: 'lastMessageId',
    type: Number,
    required: false,
    description: 'ID of the last message received (for cursor-based pagination). If not provided, returns the most recent messages.',
  })
  @ApiQuery({
    name: 'limit',
    type: Number,
    required: false,
    description: 'Number of messages to fetch (default: 20)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Messages retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Token missing or invalid',
    schema: ErrorResponseDto.schemaExample(
      'Authentication token is missing or invalid',
      'Unauthorized',
    ),
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Conversation not found',
    schema: ErrorResponseDto.schemaExample('Conversation not found', 'Not Found'),
  })
  async getMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId', ParseIntPipe) conversationId: number,
    @Query('lastMessageId', new ParseIntPipe({ optional: true })) lastMessageId?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    const result = await this.messagesService.getConversationMessages(
      conversationId,
      user.id,
      lastMessageId,
      limit || 20,
    );

    return {
      status: 'success',
      ...result,
    };
  }

  @Delete(':conversationId/:messageId')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Delete a message',
    description: 'Soft deletes a message for the authenticated user',
  })
  @ApiParam({
    name: 'conversationId',
    type: Number,
    description: 'The ID of the conversation',
  })
  @ApiParam({
    name: 'messageId',
    type: Number,
    description: 'The ID of the message to delete',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Message deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Token missing or invalid',
    schema: ErrorResponseDto.schemaExample(
      'Authentication token is missing or invalid',
      'Unauthorized',
    ),
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Message or conversation not found',
    schema: ErrorResponseDto.schemaExample('Message not found', 'Not Found'),
  })
  async removeMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId', ParseIntPipe) conversationId: number,
    @Param('messageId', ParseIntPipe) messageId: number,
  ) {
    await this.messagesService.remove({
      userId: user.id,
      conversationId,
      messageId,
    });

    return {
      status: 'success',
      message: 'Message deleted successfully',
    };
  }

  @Get(':conversationId/unseen-count')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Get unseen messages count',
    description: 'Returns the count of unseen messages in a conversation',
  })
  @ApiParam({
    name: 'conversationId',
    type: Number,
    description: 'The ID of the conversation',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Unseen messages count retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Token missing or invalid',
    schema: ErrorResponseDto.schemaExample(
      'Authentication token is missing or invalid',
      'Unauthorized',
    ),
  })
  async getUnseenCount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId', ParseIntPipe) conversationId: number,
  ) {
    const count = await this.messagesService.getUnseenMessagesCount(conversationId, user.id);

    return {
      status: 'success',
      count,
    };
  }
}
