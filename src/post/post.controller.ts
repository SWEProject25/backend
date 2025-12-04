import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  HttpStatus,
  Inject,
  MaxFileSizeValidator,
  Param,
  ParseArrayPipe,
  ParseFilePipe,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
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
  GetPostResponseDto,
  GetPostsResponseDto,
  DeletePostResponseDto,
} from './dto/post-response.dto';
import {
  ToggleLikeResponseDto,
  GetLikersResponseDto,
  GetLikedPostsResponseDto,
} from './dto/like-response.dto';
import { ToggleRepostResponseDto, GetRepostersResponseDto } from './dto/repost-response.dto';
import { SearchByHashtagResponseDto } from './dto/hashtag-search-response.dto';
import { SearchPostsResponseDto } from './dto/search-response.dto';
import { GetPostStatsResponseDto } from './dto/post-stats-response.dto';
import { ErrorResponseDto } from 'src/common/dto/error-response.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth/jwt-auth.guard';

import { AuthenticatedUser } from 'src/auth/interfaces/user.interface';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { PostFiltersDto } from './dto/post-filter.dto';
import { SearchPostsDto } from './dto/search-posts.dto';
import { SearchByHashtagDto } from './dto/search-by-hashtag.dto';
import { MentionService } from './services/mention.service';
import { ApiResponseDto } from 'src/common/dto/base-api-response.dto';
import { Mention, Post as PostModel, PostVisibility, User } from '@prisma/client';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ImageVideoUploadPipe } from 'src/storage/pipes/file-upload.pipe';
import { TimelineFeedResponseDto } from './dto/timeline-feed-reponse.dto';

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
  @UseInterceptors(FilesInterceptor('media'))
  async createPost(
    @Body() createPostDto: CreatePostDto,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFiles(ImageVideoUploadPipe) media: Express.Multer.File[],
  ) {
    createPostDto.userId = user.id;
    createPostDto.media = media;
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

  @Get('search')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Search posts by content',
    description:
      'Full-text search using trigram similarity with relevance ranking. Supports partial matching and fuzzy search.',
  })
  @ApiQuery({
    name: 'searchQuery',
    required: true,
    type: String,
    description: 'Search query to match against post content (minimum 2 characters)',
    example: 'machine learning',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    type: Number,
    description: 'Filter search results by user ID',
    example: 42,
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['POST', 'REPLY', 'QUOTE'],
    description: 'Filter search results by post type',
    example: 'POST',
  })
  @ApiQuery({
    name: 'similarityThreshold',
    required: false,
    type: Number,
    description: 'Minimum similarity threshold (0.0 to 1.0). Lower values return more results.',
    example: 0.1,
  })
  @ApiQuery({
    name: 'before_date',
    required: false,
    type: String,
    description: 'Filter posts created before this date (ISO 8601 format)',
    example: '2024-12-01T00:00:00Z',
  })
  @ApiQuery({
    name: 'order_by',
    required: false,
    enum: ['relevance', 'latest'],
    description: 'Order search results by relevance (default) or latest (created_at desc)',
    example: 'relevance',
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
    description: 'Search results retrieved successfully',
    type: SearchPostsResponseDto,
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
  async searchPosts(@Query() searchDto: SearchPostsDto, @CurrentUser() user: AuthenticatedUser) {
    const { posts, totalItems, page, limit } = await this.postService.searchPosts(
      searchDto,
      user.id,
    );

    return {
      status: 'success',
      message: 'Search results retrieved successfully',
      data: { posts },
      metadata: {
        totalItems,
        page,
        limit,
        totalPages: Math.ceil(totalItems / limit),
      },
    };
  }

  @Get('search/hashtag')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Search posts by hashtag',
    description:
      'Search posts containing a specific hashtag. Returns posts with engagement metrics and user information.',
  })
  @ApiQuery({
    name: 'hashtag',
    required: true,
    type: String,
    description: 'Hashtag to search for (with or without # symbol)',
    example: 'typescript',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    type: Number,
    description: 'Filter search results by user ID',
    example: 42,
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['POST', 'REPLY', 'QUOTE'],
    description: 'Filter search results by post type',
    example: 'POST',
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
    description: 'Posts with hashtag retrieved successfully',
    type: SearchPostsResponseDto,
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
  async searchPostsByHashtag(
    @Query() searchDto: SearchByHashtagDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const { posts, totalItems, page, limit, hashtag } = await this.postService.searchPostsByHashtag(
      searchDto,
      user.id,
    );

    return {
      status: 'success',
      message: `Posts with hashtag #${hashtag} retrieved successfully`,
      data: { posts },
      metadata: {
        hashtag,
        totalItems,
        page,
        limit,
        totalPages: Math.ceil(totalItems / limit),
      },
    };
  }

  @Get(':postId')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Get a post by ID',
    description: 'Retrieves a single post by its ID',
  })
  @ApiParam({
    name: 'postId',
    type: Number,
    description: 'The ID of the post to retrieve',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Post retrieved successfully',
    type: GetPostResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Post not found',
    type: ErrorResponseDto,
  })
  async getPostById(@Param('postId') postId: number, @CurrentUser() user: AuthenticatedUser) {
    const post = await this.postService.getPostById(postId, user.id);

    return {
      status: 'success',
      message: 'Post retrieved successfully',
      data: post,
    };
  }

  @Get(':postId/stats')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Get post stats',
    description:
      'Retrieves engagement stats for a post including likes count, reposts count, replies count, and quotes count. Stats are cached for performance.',
  })
  @ApiParam({
    name: 'postId',
    type: Number,
    description: 'The ID of the post to get stats for',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Post stats retrieved successfully',
    type: GetPostStatsResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Post not found',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Token missing or invalid',
    type: ErrorResponseDto,
  })
  async getPostStats(@Param('postId') postId: number) {
    const stats = await this.postService.getPostStats(+postId);

    return {
      status: 'success',
      message: 'Post stats retrieved successfully',
      data: stats,
    };
  }

  @Get('summary/:postId')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Get a post by ID',
    description: 'Retrieves a post summary by its ID',
  })
  @ApiParam({
    name: 'postId',
    type: Number,
    description: 'The ID of the post to retrieve',
    example: 1,
  })
  // @ApiResponse({
  //   status: HttpStatus.OK,
  //   description: 'Post retrieved successfully',
  //   type: GetPostResponseDto,
  // })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Post not found',
    type: ErrorResponseDto,
  })
  async getPostSummary(@Param('postId') postId: number) {
    const post = await this.postService.summarizePost(postId);

    return {
      status: 'success',
      message: 'Post summarized successfully',
      data: post,
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
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const replies = await this.postService.getRepliesOfPost(+postId, +page, +limit, user.id);

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
    const posts = await this.postService.getUserPosts(userId, +page, +limit);

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
    const replies = await this.postService.getUserReplies(userId, +page, +limit);

    return {
      status: 'success',
      message: 'Replies retrieved successfully',
      data: replies,
    };
  }

  @Get('timeline/for-you')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Get personalized "For You" feed',
    description:
      'Returns a ranked list of personalized posts for the authenticated user. Requires authentication.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Personalized posts retrieved successfully',
    type: TimelineFeedResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Token missing or invalid',
    type: ErrorResponseDto,
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
  async getForYouFeed(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const posts = await this.postService.getForYouFeed(user.id, page, limit);

    return {
      status: 'success',
      message: 'Posts retrieved successfully',
      data: posts,
    };
  }

  @Get('timeline/following')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Get personalized "Following" feed',
    description:
      'Returns a ranked list of posts from users the authenticated user follows. Requires authentication.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Personalized posts retrieved successfully',
    type: TimelineFeedResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Token missing or invalid',
    type: ErrorResponseDto,
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
  async getUserTimeline(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const posts = await this.postService.getFollowingForFeed(user.id, page, limit);

    return {
      status: 'success',
      message: 'Posts retrieved successfully',
      data: posts,
    };
  }

  @Get('timeline/explore')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Get personalized "Explore" feed',
    description:
      'Returns posts matching user interests with personalized ranking. Requires authentication.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Interest-based posts retrieved successfully',
    type: TimelineFeedResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Token missing or invalid',
    type: ErrorResponseDto,
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
  async getExploreFeed(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const posts = await this.postService.getExploreFeed(user.id, page, limit);

    return {
      status: 'success',
      message: 'Explore posts retrieved successfully',
      data: posts,
    };
  }

  @Get('timeline/explore/interests')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Get posts filtered by specific interests',
    description:
      'Returns posts matching provided interest names with personalized ranking. Requires authentication. Posts matching the specified interests get boosted in ranking, but all posts are shown.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Interest-filtered posts retrieved successfully',
    type: TimelineFeedResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Bad request - Interests array is required',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Token missing or invalid',
    type: ErrorResponseDto,
  })
  @ApiQuery({
    name: 'interests',
    required: true,
    type: [String],
    isArray: true,
    description: 'Array of interest names to boost ranking (required, minimum 1 interest)',
    example: ['Technology', 'Sports'],
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
  async getExploreByInterestsFeed(
    @Query('interests', new ParseArrayPipe({ items: String, optional: false })) interests: string[],
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!interests || !Array.isArray(interests) || interests.length === 0) {
      throw new BadRequestException('At least one interest is required');
    }
    const posts = await this.postService.getExploreByInterestsFeed(user.id, interests, page, limit);

    return {
      status: 'success',
      message: 'Interest-filtered posts retrieved successfully',
      data: posts,
    };
  }
}
