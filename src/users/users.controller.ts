import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags, ApiParam } from '@nestjs/swagger';
import {
  Controller,
  HttpStatus,
  Inject,
  Post,
  Delete,
  UseGuards,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { Services } from 'src/utils/constants';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth/jwt-auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from 'src/auth/interfaces/user.interface';
import { FollowResponseDto } from './dto/follow-response.dto';
import { ErrorResponseDto } from 'src/common/dto/error-response.dto';

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
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Token missing or invalid',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Conflict - Already following this user',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User to follow not found',
    type: ErrorResponseDto,
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
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Token missing or invalid',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User to unfollow not found',
    type: ErrorResponseDto,
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
}
