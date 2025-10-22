import { Body, Controller, HttpStatus, Inject, Post, UseGuards } from '@nestjs/common';
import { PostService } from './post.service';
import { Services } from 'src/utils/constants';
import { ApiBody, ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreatePostDto } from './dto/create-post.dto';
import { CreatePostResponseDto } from './dto/post-response.dto';
import { ErrorResponseDto } from 'src/common/dto/error-response.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth/jwt-auth.guard';
import { RequestWithUser } from 'src/common/interfaces/request-with-user.interface';
import { User } from 'generated/prisma';
import { AuthenticatedUser } from 'src/auth/interfaces/user.interface';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';

@ApiTags('Posts')
@Controller('post')
export class PostController {
  constructor(
    @Inject(Services.POST)
    private readonly postService: PostService,
  ) { }

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
  async createPost(
    @Body() createPostDto: CreatePostDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    createPostDto.userId = user.id;    
    const post = await this.postService.createPost(createPostDto);
    
    return {
      status: 'success',
      message: 'Post created successfully',
      data: post,
    };
  }
}
