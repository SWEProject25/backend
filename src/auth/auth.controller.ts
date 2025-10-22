import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
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
import { EmailVerificationService } from './services/email-verification/email-verification.service';
import { JwtTokenService } from './services/jwt-token/jwt-token.service';
import { Routes, Services } from 'src/utils/constants';
import { ApiResponseDto } from 'src/common/dto/base-api-response.dto';
import { ErrorResponseDto } from 'src/common/dto/error-response.dto';
import { Recaptcha } from '@nestlab/google-recaptcha';
import { RecaptchaDto } from './dto/recaptcha.dto';
import { GoogleAuthGuard } from './guards/google-auth/google-auth.guard';

@Controller(Routes.AUTH)
export class AuthController {
  constructor(
    @Inject(Services.AUTH)
    private readonly authService: AuthService,
    @Inject(Services.EMAIL_VERIFICATION)
    private readonly emailVerificationService: EmailVerificationService,
    @Inject(Services.JWT_TOKEN)
    private readonly jwtTokenService: JwtTokenService,
  ) {}

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
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - User already exists',
    type: ErrorResponseDto,
  })
  public async register(
    @Body() createUserDto: CreateUserDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.registerUser(createUserDto);

    const userProfile = result.userProfile;
    const newUser = result.newUser;
    const accessToken = await this.jwtTokenService.generateAccessToken(
      newUser.id,
      newUser.username,
    );
    this.jwtTokenService.setAuthCookies(res, accessToken);
    return {
      status: 'success',
      message: 'Account created successfully.',
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
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid credentials',
    type: ErrorResponseDto,
  })
  public async login(
    @Request() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, ...result } = await this.authService.login(
      req.user.sub,
      req.user.username,
    );
    this.jwtTokenService.setAuthCookies(res, accessToken);
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
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Get current user information',
    description:
      'Returns profile details of the currently authenticated user from the JWT token.',
  })
  @ApiResponse({
    status: 200,
    description: 'User profile successfully fetched',
    type: ApiResponseDto, // Example schema is part of the DTO now
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Token missing or invalid',
    type: ErrorResponseDto,
  })
  getMe(@CurrentUser() user: any) {
    // @TODO add user interface
    return { user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Logout user',
    description:
      'Clears authentication cookies (access_token and refresh_token).',
  })
  @ApiResponse({
    status: 200,
    description: 'Logout successful',
    type: ApiResponseDto,
  })
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie('access_token');
    response.clearCookie('refresh_token');
    return { message: 'Logout successful' };
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
    type: ApiResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Email already exists in the system',
    type: ErrorResponseDto,
  })
  public async checkEmail(@Body() { email }: CheckEmailDto) {
    console.log(email);
    await this.authService.checkEmailExistence(email);
    return { message: 'Email is available' };
  }

  @Post('verification-otp')
  @Public()
  @ApiOperation({
    summary: 'Generate and send a verification OTP',
    description:
      "Generates a new OTP and sends it to the user's email for verification.",
  })
  @ApiResponse({
    status: 200,
    description: 'Verification OTP sent successfully',
    type: ApiResponseDto,
  })
  public async generateVerificationEmail(@Body('email') email: string) {
    await this.emailVerificationService.sendVerificationEmail(email);
    return {
      status: 'success',
      message: 'Check your email for verification code',
    };
  }

  @Post('resend-otp')
  @Public()
  @ApiOperation({
    summary: 'Resend the verification OTP',
    description: "Resends a new verification OTP to the user's email.",
  })
  @ApiResponse({
    status: 200,
    description: 'Verification OTP resent successfully',
    type: ApiResponseDto,
  })
  public async resendVerificationEmail(@Body('email') email: string) {
    await this.emailVerificationService.resendVerificationEmail(email);
    return {
      status: 'success',
      message: 'Check your email for verification code',
    };
  }

  @Post('verify-otp')
  @Public()
  @ApiOperation({
    summary: 'Verify the email OTP',
    description: 'Verifies the provided OTP for the given email address.',
  })
  @ApiResponse({
    status: 200,
    description: 'Email verified successfully',
    type: ApiResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired OTP',
    type: ErrorResponseDto,
  })
  public async verifyEmailOtp(
    @Body('otp') otp: string,
    @Body('email') email: string,
  ) {
    const result = await this.emailVerificationService.verifyEmail(email, otp);

    return {
      status: result ? 'success' : 'fail',
      message: result ? 'email verified' : 'fail',
    };
  }

  @Post('verify-recaptcha')
  @Public()
  @Recaptcha() // The guard does all the work!
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verifies a Google reCAPTCHA token',
    description:
      'Endpoint to verify a user is human before allowing other actions.',
  })
  @ApiResponse({ status: 200, description: 'Human verification successful.' })
  @ApiResponse({ status: 400, description: 'reCAPTCHA verification failed.' })
  public verifyRecaptcha(@Body() recaptchaDto: RecaptchaDto) {
    // The @Recaptcha() guard runs before this method.
    // If the guard fails, it will throw an exception and this code will not be reached.
    // If the guard succeeds, we just need to return a success message.
    return {
      status: 'success',
      message: 'Human verification successful.',
    };
  }

  @Get('google/login')
  @Public()
  @UseGuards(GoogleAuthGuard)
  public googleLogin() {
    console.log('authenticated');
    return { status: 'success', message: 'Google Authenticated successfuly' };
  }

  @Get('google/redirect')
  @Public()
  @UseGuards(GoogleAuthGuard)
  public async googleRedirect(@Req() req, @Res() res: Response) {
    const { accessToken, ...user } = await this.authService.login(
      req.user.id,
      req.user.username,
    );
    this.jwtTokenService.setAuthCookies(res, accessToken);
    const html = `
      <!DOCTYPE html>
      <html lang="en">
        <body>
          <script>
            window.opener.postMessage(
              {
                status: 'success',
                data: {
                  url: '${process.env.FRONTEND_URL}/home',
                  user: ${JSON.stringify(user)}
                }
              },
              '${process.env.FRONTEND_URL}'
            );
            window.close();
          </script>
        </body>
      </html>
    `;
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  @ApiCookieAuth()
  @Get('test')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Test endpoint',
    description: 'A protected test endpoint to verify JWT authentication.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successful test',
    type: ApiResponseDto,
  })
  @UseGuards(JwtAuthGuard)
  public test() {
    return 'hello';
  }
}
