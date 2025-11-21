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
  Post,
  Get,
  UseGuards,
  Param,
  ParseIntPipe,
  Query,
  Inject,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth/jwt-auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateConversationResponseDto } from './dto/create-conversation-response.dto';
import { ErrorResponseDto } from 'src/common/dto/error-response.dto';
import { AuthenticatedUser } from 'src/auth/interfaces/user.interface';
import { Services } from 'src/utils/constants';

@ApiTags('conversations')
@Controller('conversations')
export class ConversationsController {
  constructor(
    @Inject(Services.CONVERSATIONS)
    private readonly conversationsService: ConversationsService,
  ) {}

  @Post('/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Create a conversation between two users',
    description: 'Creates a new conversation between the authenticated user and another user',
  })
  @ApiParam({
    name: 'userId',
    type: Number,
    description: 'The ID of the other user to start a conversation with',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Conversation created successfully',
    schema: {
      example: {
        status: 'success',
        data: {
          id: 15,
          updatedAt: '2025-11-21T12:27:21.174Z',
          createdAt: '2025-11-21T12:27:21.174Z',
          lastMessage: {
            id: 1,
            senderId: 47,
            text: 'Hello there!',
            createdAt: '2025-11-21T12:27:21.174Z',
            updatedAt: '2025-11-21T12:27:21.174Z',
          },
          user: {
            id: 47,
            username: 'ahmedGamalEllabban',
            profile_image_url: null,
            displayName: 'Ahmed Gamal Ellabban',
          },
        },
        metadata: {
          totalMessages: 0,
          limit: 20,
          hasMore: false,
          lastMessageId: 1,
        },
      },
    },
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
    @Param('userId', ParseIntPipe) otherUserId: number,
  ) {
    const createConversationDto: CreateConversationDto = {
      user1Id: user.id,
      user2Id: otherUserId,
    };

    const conversation = await this.conversationsService.create(createConversationDto);

    return {
      status: 'success',
      ...conversation,
    };
  }

  @Get('/')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Get all conversations for the authenticated user',
    description: 'Retrieves all conversations involving the authenticated user',
  })
  @ApiQuery({
    name: 'page',
    type: Number,
    required: false,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    type: Number,
    required: false,
    description: 'Number of conversations per page (default: 20)',
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
  async getUserConversations(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    const result = await this.conversationsService.getConversationsForUser(
      user.id,
      page || 1,
      limit || 20,
    );
    return {
      status: 'success',
      ...result,
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

  @Get('/:conversationId')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Get a specific conversation by ID',
    description: 'Retrieves a conversation by its ID if the authenticated user is a participant',
  })
  @ApiParam({
    name: 'conversationId',
    type: Number,
    description: 'The ID of the conversation to retrieve',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Conversation retrieved successfully',
    schema: {
      example: {
        status: 'success',
        data: {
          id: 15,
          updatedAt: '2025-11-21T12:27:21.174Z',
          createdAt: '2025-11-21T12:27:21.174Z',
          lastMessage: {
            id: 1,
            senderId: 47,
            text: 'Hello there!',
            createdAt: '2025-11-21T12:27:21.174Z',
            updatedAt: '2025-11-21T12:27:21.174Z',
          },
          user: {
            id: 47,
            username: 'ahmedGamalEllabban',
            profile_image_url: null,
            displayName: 'Ahmed Gamal Ellabban',
          },
        },
      },
    },
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
    status: HttpStatus.CONFLICT,
    description: 'Conflict - User not part of the conversation',
    schema: ErrorResponseDto.schemaExample('You are not part of this conversation', 'Conflict'),
  })
  async getConversationById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId', ParseIntPipe) conversationId: number,
  ) {
    const conversation = await this.conversationsService.getConversationById(
      conversationId,
      user.id,
    );
    return {
      status: 'success',
      ...conversation,
    };
  }
}
