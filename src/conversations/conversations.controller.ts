import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import {
  Controller,
  HttpStatus,
  Inject,
  Post,
  Get,
  UseGuards,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth/jwt-auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';

import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateConversationResponseDto } from './dto/create-conversation-response.dto';
import { ErrorResponseDto } from 'src/common/dto/error-response.dto';
import { AuthenticatedUser } from 'src/auth/interfaces/user.interface';

@ApiTags('conversations')
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post('/')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Create a conversation between two users',
    description: 'Creates a new conversation between the authenticated user and another user',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Conversation created successfully',
    type: CreateConversationResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Bad request - Invalid input data',
    schema: ErrorResponseDto.schemaExample('Invalid user ID provided', 'Bad Request'),
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
    status: HttpStatus.CONFLICT,
    description: 'Conflict - Conversation already exists',
    schema: ErrorResponseDto.schemaExample(
      'A conversation between these users already exists',
      'Conflict',
    ),
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User not found',
    schema: ErrorResponseDto.schemaExample('User not found', 'Not Found'),
  })
  async createConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Query('userId', ParseIntPipe) otherUserId: number,
  ) {
    const createConversationDto: CreateConversationDto = {
      user1Id: user.id,
      user2Id: otherUserId,
    };

    const conversation = await this.conversationsService.create(createConversationDto, user.id);

    return {
      status: 'success',
      conversation,
    };
  }

  @Get('/')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Get all conversations for the authenticated user',
    description: 'Retrieves all conversations involving the authenticated user',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Conversations retrieved successfully',
    type: [CreateConversationResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Token missing or invalid',
    schema: ErrorResponseDto.schemaExample(
      'Authentication token is missing or invalid',
      'Unauthorized',
    ),
  })
  async getUserConversations(@CurrentUser() user: AuthenticatedUser) {
    const conversations = await this.conversationsService.getConversationsForUser(user.id);
    return {
      status: 'success',
      conversations,
    };
  }

  @Get('/:conversationId')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Get a specific conversation by ID',
    description: 'Retrieves a conversation by its ID for the authenticated user',
  })
  @ApiParam({
    name: 'conversationId',
    type: Number,
    description: 'The ID of the conversation to retrieve',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Conversation retrieved successfully',
    type: CreateConversationResponseDto,
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
  async getConversationMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId', ParseIntPipe) conversationId: number,
  ) {
    const messages = await this.conversationsService.getConversationMessages(
      conversationId,
      user.id,
    );
    return {
      status: 'success',
      messages,
    };
  }

  @Get('/unseen')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Get count of unseen messages for the authenticated user',
    description: 'Retrieves the total number of unseen messages across all conversations',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Unseen messages count retrieved successfully',
    schema: {
      example: {
        status: 'success',
        unseenCount: 5,
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Token missing or invalid',
    schema: ErrorResponseDto.schemaExample(
      'Authentication token is missing or invalid',
      'Unauthorized',
    ),
  })
  async getUnseenMessagesCount(@CurrentUser() user: AuthenticatedUser) {
    const unseenCount = await this.conversationsService.getUnseenConversationsCount(user.id);
    return {
      status: 'success',
      unseenCount,
    };
  }
}
