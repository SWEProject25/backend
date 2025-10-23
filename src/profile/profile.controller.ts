import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { GetProfileResponseDto } from './dto/get-profile-response.dto';
import { UpdateProfileResponseDto } from './dto/update-profile-response.dto';
import { SearchProfileResponseDto } from './dto/search-profile-response.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Routes, Services } from 'src/utils/constants';
import { ErrorResponseDto } from 'src/common/dto/error-response.dto';
import { Public } from 'src/auth/decorators/public.decorator';

@ApiTags('Profile')
@Controller(Routes.PROFILE)
export class ProfileController {
  constructor(
    @Inject(Services.PROFILE)
    private readonly profileService: ProfileService,
  ) {}

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Get current user profile',
    description: 'Returns the profile of the currently authenticated user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile retrieved successfully',
    type: GetProfileResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Token missing or invalid',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Profile not found',
    type: ErrorResponseDto,
  })
  public async getMyProfile(@CurrentUser() user: any) {
    const profile = await this.profileService.getProfileByUserId(user.id);
    return {
      status: 'success',
      message: 'Profile retrieved successfully',
      data: profile,
    };
  }

  @Get('user/:userId')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get user profile by user ID',
    description: 'Returns the profile of a specific user by their user ID.',
  })
  @ApiParam({
    name: 'userId',
    description: 'The ID of the user',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Profile retrieved successfully',
    type: GetProfileResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Profile not found',
    type: ErrorResponseDto,
  })
  public async getProfileByUserId(
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    const profile = await this.profileService.getProfileByUserId(userId);
    return {
      status: 'success',
      message: 'Profile retrieved successfully',
      data: profile,
    };
  }

  @Get('username/:username')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get user profile by username',
    description: 'Returns the profile of a specific user by their username.',
  })
  @ApiParam({
    name: 'username',
    description: 'The username of the user',
    type: String,
    example: 'john_doe',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile retrieved successfully',
    type: GetProfileResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Profile not found',
    type: ErrorResponseDto,
  })
  public async getProfileByUsername(@Param('username') username: string) {
    const profile = await this.profileService.getProfileByUsername(username);
    return {
      status: 'success',
      message: 'Profile retrieved successfully',
      data: profile,
    };
  }

  @Get('search')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Search profiles by username or name',
    description:
      'Search for user profiles by partial match on username or name. Supports pagination.',
  })
  @ApiQuery({
    name: 'query',
    description: 'Search query to match against username or name',
    type: String,
    example: 'john',
    required: true,
  })
  @ApiQuery({
    name: 'page',
    description: 'Page number',
    type: Number,
    example: 1,
    required: false,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Number of items per page',
    type: Number,
    example: 10,
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Profiles found successfully',
    type: SearchProfileResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid query',
    type: ErrorResponseDto,
  })
  public async searchProfiles(
    @Query('query') query: string,
    @Query() paginationDto: PaginationDto,
  ) {
    if (!query || query.trim().length === 0) {
      return {
        status: 'success',
        message: 'No search query provided',
        data: [],
        metadata: {
          total: 0,
          page: paginationDto.page,
          limit: paginationDto.limit,
          totalPages: 0,
        },
      };
    }

    const result = await this.profileService.searchProfiles(
      query.trim(),
      paginationDto.page,
      paginationDto.limit,
    );

    return {
      status: 'success',
      message:
        result.profiles.length > 0
          ? 'Profiles found successfully'
          : 'No profiles found',
      data: result.profiles,
      metadata: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    };
  }

  @Patch('me')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Update current user profile',
    description: 'Updates the profile of the currently authenticated user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
    type: UpdateProfileResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Token missing or invalid',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Profile not found',
    type: ErrorResponseDto,
  })
  public async updateMyProfile(
    @CurrentUser() user: any,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    const updatedProfile = await this.profileService.updateProfile(
      user.id,
      updateProfileDto,
    );
    return {
      status: 'success',
      message: 'Profile updated successfully',
      data: updatedProfile,
    };
  }
}
