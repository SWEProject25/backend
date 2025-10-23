import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PostService } from './services/post.service';
import { LikeService } from './services/like.service';
import { RepostService } from './services/repost.service';
import { Services } from 'src/utils/constants';
import {
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreatePostDto } from './dto/create-post.dto';
import {
  CreatePostResponseDto,
  GetPostsResponseDto,
  DeletePostResponseDto,
} from './dto/post-response.dto';
import {
  ToggleLikeResponseDto,
  GetLikersResponseDto,
  GetLikedPostsResponseDto,
} from './dto/like-response.dto';
import { ToggleRepostResponseDto, GetRepostersResponseDto } from './dto/repost-response.dto';
import { ErrorResponseDto } from 'src/common/dto/error-response.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth/jwt-auth.guard';

import { AuthenticatedUser } from 'src/auth/interfaces/user.interface';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { PostFiltersDto } from './dto/post-filter.dto';
import { MentionService } from './services/mention.service';
import { ApiResponseDto } from 'src/common/dto/base-api-response.dto';
import { Mention, Post as PostModel, PostVisibility, User } from 'generated/prisma';

@ApiTags('Posts')
@Controller('posts')
export class PostController {
  constructor(
    @Inject(Services.POST)
    private readonly postService: PostService,
    @Inject(Services.LIKE)
    private readonly likeService: LikeService,
    @Inject(Services.REPOST)
    private readonly repostService: RepostService,
    @Inject(Services.MENTION)
    private readonly mentionService: MentionService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Create a new post',
    description: 'Creates a new post with the provided content and settings',
  })
  @ApiBody({
    type: CreatePostDto,
    description: 'Post creation data',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Post successfully created',
    type: CreatePostResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Bad request - Invalid input data',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Token missing or invalid',
    type: ErrorResponseDto,
  })
  async createPost(@Body() createPostDto: CreatePostDto, @CurrentUser() user: AuthenticatedUser) {
    createPostDto.userId = user.id;
    const post = await this.postService.createPost(createPostDto);

    return {
      status: 'success',
      message: 'Post created successfully',
      data: post,
    };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Get posts with optional filters',
    description: 'Retrieves posts with optional filtering by user ID, hashtag, and pagination',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    type: Number,
    description: 'Filter posts by user ID',
    example: 42,
  })
  @ApiQuery({
    name: 'hashtag',
    required: false,
    type: String,
    description: 'Filter posts by hashtag',
    example: '#nestjs',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number for pagination',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of posts per page',
    example: 10,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Posts retrieved successfully',
    type: GetPostsResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Bad request - Invalid query parameters',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Token missing or invalid',
    type: ErrorResponseDto,
  })
  async getPosts(@Query() filters: PostFiltersDto, @CurrentUser() user: AuthenticatedUser) {
    const posts = await this.postService.getPostsWithFilters(filters);

    return {
      status: 'success',
      message: 'Posts retrieved successfully',
      data: posts,
    };
  }

  @Post(':postId/like')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Toggle like on a post',
    description: 'Likes a post if not already liked, or unlikes it if already liked',
  })
  @ApiParam({
    name: 'postId',
    type: Number,
    description: 'The ID of the post to toggle like',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Like toggled successfully',
    type: ToggleLikeResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Bad request - Invalid post ID',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Token missing or invalid',
    type: ErrorResponseDto,
  })
  async togglePostLike(@Param('postId') postId: number, @CurrentUser() user: AuthenticatedUser) {
    const result = await this.likeService.togglePostLike(+postId, user.id);

    return {
      status: 'success',
      message: result.message,
      data: result,
    };
  }

  @Get(':postId/likers')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Get list of users who liked a post',
    description: 'Retrieves a paginated list of users who liked the specified post',
  })
  @ApiParam({
    name: 'postId',
    type: Number,
    description: 'The ID of the post to get likers for',
    example: 1,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number for pagination',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of likers per page',
    example: 10,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Likers retrieved successfully',
    type: GetLikersResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Bad request - Invalid parameters',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Token missing or invalid',
    type: ErrorResponseDto,
  })
  async getPostLikers(
    @Param('postId') postId: number,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    const likers = await this.likeService.getListOfLikers(+postId, +page, +limit);

    return {
      status: 'success',
      message: 'Likers retrieved successfully',
      data: likers,
    };
  }

  @Get(':postId/replies')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Get replies to a post',
    description: 'Retrieves a paginated list of replies to the specified post',
  })
  @ApiParam({
    name: 'postId',
    type: Number,
    description: 'The ID of the post to get replies for',
    example: 1,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number for pagination',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of replies per page',
    example: 10,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Replies retrieved successfully',
    type: GetPostsResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Bad request - Invalid parameters',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Token missing or invalid',
    type: ErrorResponseDto,
  })
  async getPostReplies(
    @Param('postId') postId: number,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    const replies = await this.postService.getRepliesOfPost(+postId, +page, +limit);

    return {
      status: 'success',
      message: 'Replies retrieved successfully',
      data: replies,
    };
  }

  @Post(':postId/repost')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Toggle repost on a post',
    description: 'Reposts a post if not already reposted, or removes repost if already reposted',
  })
  @ApiParam({
    name: 'postId',
    type: Number,
    description: 'The ID of the post to toggle repost',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Repost toggled successfully',
    type: ToggleRepostResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Bad request - Invalid post ID',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Token missing or invalid',
    type: ErrorResponseDto,
  })
  async toggleRepost(@Param('postId') postId: number, @CurrentUser() user: AuthenticatedUser) {
    const result = await this.repostService.toggleRepost(+postId, user.id);

    return {
      status: 'success',
      message: result.message,
      data: result,
    };
  }

  @Get(':postId/reposters')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Get list of users who reposted a post',
    description: 'Retrieves a paginated list of users who reposted the specified post',
  })
  @ApiParam({
    name: 'postId',
    type: Number,
    description: 'The ID of the post to get reposters for',
    example: 1,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number for pagination',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of reposters per page',
    example: 10,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Reposters retrieved successfully',
    type: GetRepostersResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Bad request - Invalid parameters',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Token missing or invalid',
    type: ErrorResponseDto,
  })
  async getPostReposters(
    @Param('postId') postId: number,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const reposters = await this.repostService.getReposters(+postId, +page, +limit);

    const users = reposters.map((repost) => repost.user);

    return {
      status: 'success',
      message: 'Reposters retrieved successfully',
      data: users,
    };
  }

  @Get('liked/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Get posts liked by a user',
    description: 'Retrieves a paginated list of posts that the specified user has liked',
  })
  @ApiParam({
    name: 'userId',
    type: Number,
    description: 'The ID of the user to get liked posts for',
    example: 1,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number for pagination',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of liked posts per page',
    example: 10,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Liked posts retrieved successfully',
    type: GetLikedPostsResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Bad request - Invalid parameters',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Token missing or invalid',
    type: ErrorResponseDto,
  })
  async getUserLikedPosts(
    @Param('userId') userId: number,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    const likedPosts = await this.likeService.getLikedPostsByUser(+userId, +page, +limit);

    return {
      status: 'success',
      message: 'Liked posts retrieved successfully',
      data: likedPosts,
    };
  }

  @Delete(':postId')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Delete a post',
    description: 'Soft deletes a post and all its replies and quotes',
  })
  @ApiParam({
    name: 'postId',
    type: Number,
    description: 'The ID of the post to delete',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Post deleted successfully',
    type: DeletePostResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Bad request - Invalid post ID',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Token missing or invalid',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Post not found',
    type: ErrorResponseDto,
  })
  async deletePost(@Param('postId') postId: number) {
    await this.postService.deletePost(+postId);

    return {
      status: 'success',
      message: 'Post deleted successfully',
    };
  }

  @Post(':postId/mention/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Mention a user in a post',
    description: 'Mentions a user in the context of a specific post',
  })
  @ApiParam({
    name: 'postId',
    type: Number,
    description: 'The ID of the post to mention the user in',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User mentioned successfully',
    type: ApiResponseDto<Mention>,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Bad request - Invalid post ID or user ID',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Token missing or invalid',
    type: ErrorResponseDto,
  })
  async mentionInPost(@Param('postId') postId: number, @Param('userId') userId: number) {
    const result = await this.mentionService.mentionUser(userId, postId);

    return {
      status: 'success',
      message: 'User mentioned successfully',
      data: result,
    };
  }

  @Get('mentioned/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Get posts mentioned by a user',
    description:
      'Retrieves a paginated list of posts that the specified user has been mentioned in',
  })
  @ApiParam({
    name: 'userId',
    type: Number,
    description: 'The ID of the user to get mentioned posts for',
    example: 1,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number for pagination',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of mentioned posts per page',
    example: 10,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Mentioned posts retrieved successfully',
    type: ApiResponseDto<PostModel>,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Bad request - Invalid parameters',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Token missing or invalid',
    type: ErrorResponseDto,
  })
  async getPostsMentioned(
    @Param('userId') userId: number,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    const mentionedPosts = await this.mentionService.getMentionedPosts(+userId, +page, +limit);

    return {
      status: 'success',
      message: 'Mentioned posts retrieved successfully',
      data: mentionedPosts,
    };
  }

  @Get(':postId/mentions')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Get list of users who mentioned a post',
    description: 'Retrieves a paginated list of users who mentioned the specified post',
  })
  @ApiParam({
    name: 'postId',
    type: Number,
    description: 'The ID of the post to get mentions for',
    example: 1,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number for pagination',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of mentions per page',
    example: 10,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Mentions retrieved successfully',
    type: ApiResponseDto<User[]>,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Bad request - Invalid parameters',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Token missing or invalid',
    type: ErrorResponseDto,
  })
  async getMentionsInPost(
    @Param('postId') postId: number,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    const mentions = await this.mentionService.getMentionsForPost(+postId, +page, +limit);

    return {
      status: 'success',
      message: 'Mentions retrieved successfully',
      data: mentions,
    };
  }

  @Get('profile/me')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Get user profile posts',
    description: 'Retrieves a paginated list of posts created by the authenticated user',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number for pagination',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of posts per page',
    example: 10,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Posts retrieved successfully',
    type: ApiResponseDto<PostModel[]>,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Token missing or invalid',
    type: ErrorResponseDto,
  })
  async getProfilePosts(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const posts = await this.postService.getUserPosts(user.id, +page, +limit);

    return {
      status: 'success',
      message: 'Posts retrieved successfully',
      data: posts,
    };
  }

  @Get('profile/me/replies')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Get user profile replies',
    description: 'Retrieves a paginated list of replies created by the authenticated user',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number for pagination',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of replies per page',
    example: 10,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Replies retrieved successfully',
    type: ApiResponseDto<PostModel[]>,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Token missing or invalid',
    type: ErrorResponseDto,
  })
  async getProfileReplies(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const replies = await this.postService.getUserReplies(user.id, +page, +limit);

    return {
      status: 'success',
      message: 'Replies retrieved successfully',
      data: replies,
    };
  }

  @Get('profile/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiParam({
    name: 'userId',
    type: Number,
    description: 'The ID of the user to get his/her posts for',
    example: 1,
  })
  @ApiOperation({
    summary: 'Get user profile posts',
    description: 'Retrieves a paginated list of posts created by the specified user',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number for pagination',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of posts per page',
    example: 10,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Posts retrieved successfully',
    type: ApiResponseDto<PostModel[]>,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Token missing or invalid',
    type: ErrorResponseDto,
  })
  async getUserPosts(
    @Param('userId') userId: number,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    const posts = await this.postService.getUserPosts(
      userId,
      +page,
      +limit,
      PostVisibility.EVERY_ONE,
    );

    return {
      status: 'success',
      message: 'Posts retrieved successfully',
      data: posts,
    };
  }

  @Get('profile/:userId/replies')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Get user profile replies',
    description: 'Retrieves a paginated list of replies created by the specified user',
  })
  @ApiParam({
    name: 'userId',
    type: Number,
    description: 'The ID of the user to get his/her replies for',
    example: 1,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number for pagination',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of replies per page',
    example: 10,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Replies retrieved successfully',
    type: ApiResponseDto<PostModel[]>,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Token missing or invalid',
    type: ErrorResponseDto,
  })
  async getUserReplies(
    @Param('userId') userId: number,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    const replies = await this.postService.getUserReplies(
      userId,
      +page,
      +limit,
      PostVisibility.EVERY_ONE,
    );

    return {
      status: 'success',
      message: 'Replies retrieved successfully',
      data: replies,
    };
  }

  @Get('timeline')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Get user timeline posts',
    description: 'Retrieves a paginated list of posts for the authenticated user timeline',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number for pagination',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of posts per page',
    example: 10,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Timeline posts retrieved successfully',
    type: ApiResponseDto<PostModel[]>,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Token missing or invalid',
    type: ErrorResponseDto,
  })
  async getUserTimeline(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const posts = await this.postService.getUserTimeline(user.id, page, limit);

    return {
      status: 'success',
      message: 'Timeline posts retrieved successfully',
      data: posts,
    };
  }
}
