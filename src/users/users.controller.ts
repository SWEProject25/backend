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
  Delete,
  Get,
  UseGuards,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { Services } from 'src/utils/constants';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth/jwt-auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from 'src/auth/interfaces/user.interface';
import { FollowResponseDto } from './dto/follow-response.dto';
import { ErrorResponseDto } from 'src/common/dto/error-response.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { FollowerDto } from './dto/follower.dto';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(
    @Inject(Services.USERS)
    private readonly usersService: UsersService,
  ) {}

  @Post(':id/follow')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Follow a user',
    description: 'Creates a follow relationship between the authenticated user and target user',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'The ID of the user to follow',
    example: 123,
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Successfully followed the user',
    type: FollowResponseDto,
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
    description: 'Conflict - Already following this user',
    schema: ErrorResponseDto.schemaExample('You are already following this user', 'Conflict'),
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User to follow not found',
    schema: ErrorResponseDto.schemaExample('User not found', 'Not Found'),
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal server error',
    schema: ErrorResponseDto.schemaExample('Internal server error', '500', 'fail'),
  })
  async followUser(
    @Param('id', ParseIntPipe) followingId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const follow = await this.usersService.followUser(user.id, followingId);

    return {
      status: 'success',
      message: 'User followed successfully',
      data: follow,
    };
  }

  @Delete(':id/follow')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Unfollow a user',
    description: 'Removes the follow relationship between the authenticated user and target user',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'The ID of the user to unfollow',
    example: 123,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully unfollowed the user',
    type: FollowResponseDto,
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
    status: HttpStatus.NOT_FOUND,
    description: 'User to unfollow not found',
    schema: ErrorResponseDto.schemaExample('User not found', 'Not Found'),
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal server error',
    schema: ErrorResponseDto.schemaExample('Internal server error', '500', 'fail'),
  })
  async unfollowUser(
    @Param('id', ParseIntPipe) unfollowingId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const unfollow = await this.usersService.unfollowUser(user.id, unfollowingId);

    return {
      status: 'success',
      message: 'User unfollowed successfully',
      data: unfollow,
    };
  }

  @Get(':id/followers')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Get user followers',
    description: 'Retrieves a paginated list of users who follow the specified user',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'The ID of the user',
    example: 123,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 10, max: 100)',
    example: 10,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully retrieved followers',
    type: FollowerDto,
    isArray: true,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Bad request - Invalid input data',
    schema: ErrorResponseDto.schemaExample('Invalid pagination parameters', 'Bad Request'),
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
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal server error',
    schema: ErrorResponseDto.schemaExample('Internal server error', '500', 'fail'),
  })
  async getFollowers(
    @Param('id', ParseIntPipe) userId: number,
    @Query() paginationQuery: PaginationDto,
  ) {
    const { data, metadata } = await this.usersService.getFollowers(
      userId,
      paginationQuery.page,
      paginationQuery.limit,
    );

    return {
      status: 'success',
      message: 'Followers retrieved successfully',
      data,
      metadata,
    };
  }

  @Get(':id/following')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Get users followed by a user',
    description: 'Retrieves a paginated list of users that the specified user is following',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'The ID of the user',
    example: 123,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 10, max: 100)',
    example: 10,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully retrieved following users',
    type: FollowerDto,
    isArray: true,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Bad request - Invalid input data',
    schema: ErrorResponseDto.schemaExample('Invalid pagination parameters', 'Bad Request'),
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
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal server error',
    schema: ErrorResponseDto.schemaExample('Internal server error', '500', 'fail'),
  })
  async getFollowing(
    @Param('id', ParseIntPipe) userId: number,
    @Query() paginationQuery: PaginationDto,
  ) {
    const { data, metadata } = await this.usersService.getFollowing(
      userId,
      paginationQuery.page,
      paginationQuery.limit,
    );

    return {
      status: 'success',
      message: 'Following users retrieved successfully',
      data,
      metadata,
    };
  }
}
