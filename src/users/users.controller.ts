import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
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
  HttpCode,
  Req,
  Body,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { Services } from 'src/utils/constants';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth/jwt-auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from 'src/auth/interfaces/user.interface';
import { FollowResponseDto } from './dto/follow-response.dto';
import { ErrorResponseDto } from 'src/common/dto/error-response.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { UserInteractionDto } from './dto/UserInteraction.dto';
import { BlockResponseDto } from './dto/block-response.dto';
import { MuteResponseDto } from './dto/mute-response.dto';
import { GetSuggestedUsersQueryDto, SuggestedUsersResponseDto } from './dto/suggested-users.dto';
import { Public } from 'src/auth/decorators/public.decorator';
import {
  GetAllInterestsResponseDto,
  GetUserInterestsResponseDto,
  SaveUserInterestsDto,
  SaveUserInterestsResponseDto,
} from './dto/interest.dto';
import { OptionalJwtAuthGuard } from 'src/auth/guards/optional-jwt-auth/optional-jwt-auth.guard';

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
    type: UserInteractionDto,
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
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const { data, metadata } = await this.usersService.getFollowers(
      userId,
      paginationQuery.page,
      paginationQuery.limit,
      currentUser.id,
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
    type: UserInteractionDto,
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
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const { data, metadata } = await this.usersService.getFollowing(
      userId,
      paginationQuery.page,
      paginationQuery.limit,
      currentUser.id,
    );

    return {
      status: 'success',
      message: 'Following users retrieved successfully',
      data,
      metadata,
    };
  }

  @Post(':id/block')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Block a user',
    description: 'Blocks the specified user for the authenticated user',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'The ID of the user to block',
    example: 123,
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Successfully blocked the user',
    type: BlockResponseDto,
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
    description: 'Conflict - Cannot block yourself',
    schema: ErrorResponseDto.schemaExample('You cannot block yourself', 'Conflict'),
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User to block not found',
    schema: ErrorResponseDto.schemaExample('User to block not found', 'Not Found'),
  })
  async blockUser(
    @Param('id', ParseIntPipe) blockedId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.usersService.blockUser(user.id, blockedId);

    return {
      status: 'success',
      message: 'User blocked successfully',
    };
  }

  @Delete(':id/block')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Unblock a user',
    description: 'Unblocks the specified user for the authenticated user',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'The ID of the user to unblock',
    example: 123,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully unblocked the user',
    type: BlockResponseDto,
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
    description: 'Conflict - Cannot unblock yourself',
    schema: ErrorResponseDto.schemaExample('You cannot unblock yourself', 'Conflict'),
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Conflict - User not blocked',
    schema: ErrorResponseDto.schemaExample('You have not blocked this user', 'Conflict'),
  })
  async unblockUser(
    @Param('id', ParseIntPipe) blockedId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.usersService.unblockUser(user.id, blockedId);

    return {
      status: 'success',
      message: 'User unblocked successfully',
    };
  }

  @Get('blocks/me')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Get blocked users',
    description: 'Retrieves a paginated list of users blocked by the authenticated user',
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
    description: 'Successfully retrieved blocked users',
    type: UserInteractionDto,
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
  async getBlockedUsers(
    @CurrentUser() user: AuthenticatedUser,
    @Query() paginationQuery: PaginationDto,
  ) {
    const { data, metadata } = await this.usersService.getBlockedUsers(
      user.id,
      paginationQuery.page,
      paginationQuery.limit,
    );
    return {
      status: 'success',
      message: 'Blocked users retrieved successfully',
      data,
      metadata,
    };
  }

  @Post(':id/mute')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Mute a user',
    description: 'Mutes the specified user for the authenticated user',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'The ID of the user to mute',
    example: 123,
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Successfully muted the user',
    type: MuteResponseDto,
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
    description: 'Conflict - Cannot mute yourself',
    schema: ErrorResponseDto.schemaExample('You cannot mute yourself', 'Conflict'),
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User to mute not found',
    schema: ErrorResponseDto.schemaExample('User to mute not found', 'Not Found'),
  })
  async muteUser(
    @Param('id', ParseIntPipe) mutedId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.usersService.muteUser(user.id, mutedId);

    return {
      status: 'success',
      message: 'User muted successfully',
    };
  }

  @Delete(':id/mute')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Unmute a user',
    description: 'Unmutes the specified user for the authenticated user',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'The ID of the user to unmute',
    example: 123,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully unmuted the user',
    type: MuteResponseDto,
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
    description: 'Conflict - Cannot unmute yourself',
    schema: ErrorResponseDto.schemaExample('You cannot unmute yourself', 'Conflict'),
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User to unmute not found',
    schema: ErrorResponseDto.schemaExample('User to unmute not found', 'Not Found'),
  })
  async unmuteUser(
    @Param('id', ParseIntPipe) unmutedId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.usersService.unmuteUser(user.id, unmutedId);

    return {
      status: 'success',
      message: 'User unmuted successfully',
    };
  }

  @Get('mutes/me')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Get muted users',
    description: 'Retrieves a paginated list of users muted by the authenticated user',
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
    description: 'Successfully retrieved muted users',
    type: UserInteractionDto,
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
  async getMutedUsers(
    @CurrentUser() user: AuthenticatedUser,
    @Query() paginationQuery: PaginationDto,
  ) {
    const { data, metadata } = await this.usersService.getMutedUsers(
      user.id,
      paginationQuery.page,
      paginationQuery.limit,
    );
    return {
      status: 'success',
      message: 'Muted users retrieved successfully',
      data,
      metadata,
    };
  }
  @Get('suggested')
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get suggested users to follow',
    description: `
    Returns suggested users based on popularity (follower count).
    
    **Public access:** Shows all popular users (for landing pages, marketing)
    **Authenticated access:** Excludes already followed and blocked users by default
    
    Query parameters allow fine-tuning the behavior.
  `,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully retrieved suggested users',
    type: SuggestedUsersResponseDto,
  })
  async getSuggestedUsers(
    @Query() query: GetSuggestedUsersQueryDto,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<SuggestedUsersResponseDto> {
    const limit = query.limit || 10;
    const userId = user?.id; // Will be undefined if not authenticated

    // Default behavior: exclude followed and blocked if authenticated
    const excludeFollowed = query.excludeFollowed ?? !!userId;
    const excludeBlocked = query.excludeBlocked ?? !!userId;

    const data = await this.usersService.getSuggestedUsers(
      userId,
      limit,
      excludeFollowed,
      excludeBlocked,
    );

    return {
      status: 'success',
      message:
        data.length > 0 ? 'Successfully retrieved suggested users' : 'No suggested users available',
      total: data.length,
      data: { users: data },
    };
  }

  @Get('interests/me')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Get current user's interests",
    description: 'Returns the interests selected by the authenticated user',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully retrieved user interests',
    type: GetUserInterestsResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User not authenticated',
  })
  async getUserInterests(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GetUserInterestsResponseDto> {
    const userId = user?.id;
    const data = await this.usersService.getUserInterests(userId);

    return {
      status: 'success',
      message: 'Successfully retrieved user interests',
      data,
      total: data.length,
    };
  }

  @Post('interests/me')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Save user interests',
    description:
      'Save user interests and mark the interests onboarding step as complete. This replaces all existing interests.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Interests saved successfully',
    type: SaveUserInterestsResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid interest IDs provided or no interests selected',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User not authenticated',
  })
  async saveUserInterests(
    @Req() req: any,
    @Body() saveUserInterestsDto: SaveUserInterestsDto,
  ): Promise<SaveUserInterestsResponseDto> {
    const userId = req.user?.id;
    const savedCount = await this.usersService.saveUserInterests(
      userId,
      saveUserInterestsDto.interestIds,
    );

    return {
      status: 'success',
      message: 'Interests saved successfully. Please follow some users to complete onboarding.',
      savedCount,
    };
  }

  @Get('interests')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get all available interests',
    description:
      'Returns all interests that users can select during onboarding or profile setup. Public endpoint, no authentication required.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully retrieved all interests',
    type: GetAllInterestsResponseDto,
  })
  async getAllInterests(): Promise<GetAllInterestsResponseDto> {
    const interests = await this.usersService.getAllInterests();

    return {
      status: 'success',
      message: 'Successfully retrieved interests',
      total: interests.length,
      data: interests,
    };
  }
}
