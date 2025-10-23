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
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileResponseDto } from './dto/profile-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Routes, Services } from 'src/utils/constants';
import { ApiResponseDto } from 'src/common/dto/base-api-response.dto';
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
    type: ProfileResponseDto,
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
    type: ProfileResponseDto,
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
    type: ProfileResponseDto,
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
    type: ApiResponseDto,
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
