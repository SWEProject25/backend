import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import {
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { LocalAuthGuard } from './guards/local-auth/local-auth.guard';
import { Response } from 'express';
import { JwtAuthGuard } from './guards/jwt-auth/jwt-auth.guard';
import { RequestWithUser } from 'src/common/interfaces/request-with-user.interface';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { RegisterResponseDto } from './dto/register-response.dto';
import { Public } from './decorators/public.decorator';
import { CheckEmailDto } from './dto/check-email.dto';
import { CurrentUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  @ApiOperation({
    summary: 'Register a new user',
    description: 'Creates a new user account with the provided details',
  })
  @ApiResponse({
    status: 201,
    description: 'User successfully registered',
    type: RegisterResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid input data',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - User already exists',
  })
  public async register(@Body() createUserDto: CreateUserDto) {
    const result = await this.authService.registerUser(createUserDto);

    const userProfile = result.userProfile;
    const newUser = result.newUser;

    return {
      status: 'success',
      message:
        'Account created successfully. Please check your email for verification',
      data: {
        user: {
          username: newUser.username,
          role: newUser.role,
          email: newUser.email,
          name: userProfile.name,
          birth_date: userProfile.birth_date,
          profile_image_url: userProfile.profile_image_url,
          banner_image_url: userProfile.banner_image_url,
          bio: userProfile.bio,
          location: userProfile.location,
          website: userProfile.website,
          created_at: newUser.created_at,
        },
      },
    };
  }

  @Post('login')
  @Public()
  @UseGuards(LocalAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login using email and password',
    description: 'Login with the provided details (JWT set as HTTPOnly cookie)',
  })
  @ApiBody({ type: LoginDto, description: 'User login credentials' })
  @ApiResponse({
    status: 200,
    description: 'User successfully logged in',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid input data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid credentials',
  })
  public async login(
    @Request() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, ...result } = await this.authService.login(
      req.user.sub,
      req.user.username,
    );
    this.authService.setAuthCookies(res, accessToken);
    return {
      status: 'success',
      message: 'Logged in successfully',
      date: {
        user: {
          id: result.user.id,
          name: result.user.username,
        },
      },
    };
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  getMe(@CurrentUser() user: any) {
    // @TODO add user interface
    return { user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie('access_token');
    response.clearCookie('refresh_token');
    return {
      message: 'Logout successful',
    };
  }

  @Post('check-email')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Check if an email already exists',
    description:
      'Verifies whether the given email is already registered in the system.',
  })
  @ApiBody({
    description: 'Email to be checked',
    type: CheckEmailDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Email is available for registration',
    schema: {
      example: { message: 'Email is available' },
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Email already exists in the system',
    schema: {
      example: {
        statusCode: 409,
        message: 'Email already in use',
        error: 'Conflict',
      },
    },
  })
  public async checkEmail(@Body() { email }: CheckEmailDto) {
    console.log(email);
    await this.authService.checkEmailExistence(email);
    return { message: 'Email is available' };
  }

  @Post('verification-otp')
  @Public()
  public async generateVerificationEmail(@Body('email') email: string) {
    await this.authService.generateVerificationEmail(email);
    return {
      status: 'success',
      message: 'Check your email for verification code',
    };
  }

  @Post('resend-otp')
  @Public()
  public async resendVerificationEmail(@Body('email') email: string) {
    await this.authService.resendVerificationEmail(email);
    return {
      status: 'success',
      message: 'Check your email for verification code',
    };
  }

  @Post('verify-otp')
  @Public()
  public async verifyEmailOtp(
    @Body('otp') otp: string,
    @Body('email') email: string,
  ) {
    const result = await this.authService.verifyEmailOtp(email, otp);

    return {
      status: result ? 'success' : 'fail',
      message: result ? 'email verified' : 'fail',
    };
  }

  @ApiCookieAuth()
  @Get('test')
  @UseGuards(JwtAuthGuard)
  public test() {
    return 'hello';
  }
}
