import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Query,
  Req,
  Request,
  Res,
  UseGuards,
  Patch,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTooManyRequestsResponse,
  ApiUnprocessableEntityResponse,
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
import { GithubAuthGuard } from './guards/github-auth/github-auth.guard';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { PasswordService } from './services/password/password.service';
import { VerifyResetTokenDto } from './dto/verify-token-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateEmailDto } from 'src/user/dto/update-email.dto';
import { UpdateUsernameDto } from 'src/user/dto/update-username.dto';
import { EmailDto, VerifyOtpDto } from './dto/email-verification.dto';

@Controller(Routes.AUTH)
export class AuthController {
  constructor(
    @Inject(Services.AUTH)
    private readonly authService: AuthService,
    @Inject(Services.EMAIL_VERIFICATION)
    private readonly emailVerificationService: EmailVerificationService,
    @Inject(Services.JWT_TOKEN)
    private readonly jwtTokenService: JwtTokenService,
    @Inject(Services.PASSWORD)
    private readonly passwordService: PasswordService,
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
          profileImageUrl: userProfile.profile_image_url,
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
  public async login(@Request() req: RequestWithUser, @Res({ passthrough: true }) res: Response) {
    const { accessToken, ...result } = await this.authService.login(
      req.user.sub,
      req.user.username,
    );
    this.jwtTokenService.setAuthCookies(res, accessToken);
    return {
      status: 'success',
      message: 'Logged in successfully',
      data: {
        user: {
          username: req.user.username,
          role: req.user.role,
          email: req.user.email,
          name: req.user.name,
          profileImageUrl: req.user.profileImageUrl,
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
    description: 'Returns profile details of the currently authenticated user from the JWT token.',
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
    description: 'Clears authentication cookies (access_token and refresh_token).',
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
    description: 'Verifies whether the given email is already registered in the system.',
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
      "Generates a new One-Time Password (OTP) and sends it to the user's email. Throws 409 if already verified, 429 if rate-limited, and 404 if user not found.",
  })
  @ApiResponse({
    status: 200,
    description: 'Verification OTP sent successfully',
    type: ApiResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid email or malformed request',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'User not found',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Account already verified',
    type: ErrorResponseDto,
  })
  @ApiTooManyRequestsResponse({
    description: 'Too many OTP requests in a short time',
    type: ErrorResponseDto,
  })
  public async generateVerificationEmail(@Body() emailVerificationDto: EmailDto) {
    await this.emailVerificationService.sendVerificationEmail(emailVerificationDto.email);
    return {
      status: 'success',
      message: 'Check your email for verification code',
    };
  }

  @Post('resend-otp')
  @Public()
  @ApiOperation({
    summary: 'Resend the verification OTP',
    description:
      'Resends a new OTP to the same email. Applies same validation and rate-limit rules(wait for 1 min between each resend).',
  })
  @ApiResponse({
    status: 200,
    description: 'Verification OTP resent successfully',
    type: ApiResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid email or malformed request',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'User not found',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Account already verified',
    type: ErrorResponseDto,
  })
  @ApiTooManyRequestsResponse({
    description: 'Too many OTP requests in a short time',
    type: ErrorResponseDto,
  })
  public async resendVerificationEmail(@Body() emailVerificationDto: EmailDto) {
    await this.emailVerificationService.resendVerificationEmail(emailVerificationDto.email);
    return {
      status: 'success',
      message: 'Check your email for verification code',
    };
  }

  @Post('verify-otp')
  @Public()
  @ApiOperation({
    summary: 'Verify the email OTP',
    description:
      'Verifies the provided OTP for the given email. Throws 422 if invalid or expired, 409 if already verified, and 404 if user not found.',
  })
  @ApiResponse({
    status: 200,
    description: 'Email verified successfully',
    type: ApiResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid email or OTP format',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'User not found',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Account already verified',
    type: ErrorResponseDto,
  })
  @ApiUnprocessableEntityResponse({
    description: 'Invalid or expired OTP',
    type: ErrorResponseDto,
  })
  public async verifyEmailOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    const result = await this.emailVerificationService.verifyEmail(verifyOtpDto);

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
    description: 'Endpoint to verify a user is human before allowing other actions.',
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

  @Post('forgotPassword')
  @HttpCode(HttpStatus.OK)
  @Public()
  @ApiOperation({ summary: 'Request a password reset link' })
  @ApiResponse({
    status: 200,
    description: 'Reset link successfully sent to the provided email',
    schema: {
      example: {
        status: 'success',
        message: 'Check your email for password reset instructions',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 400, description: 'Invalid email format' })
  async requestPasswordReset(@Body() requestPasswordResetDto: RequestPasswordResetDto) {
    await this.passwordService.requestPasswordReset(requestPasswordResetDto);

    return {
      status: 'success',
      message: 'Check your email, you will receive password reset instructions',
    };
  }

  @Get('verifyResetToken')
  @HttpCode(HttpStatus.OK)
  @Public()
  @ApiOperation({ summary: 'Verify if a reset token is valid' })
  @ApiResponse({
    status: 200,
    description: 'Token is valid',
    schema: {
      example: {
        status: 'success',
        message: 'Token is valid',
        data: { valid: true },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Token invalid or expired' })
  async verifyResetToken(@Query() verifyResetTokenDto: VerifyResetTokenDto) {
    const isValid = await this.passwordService.verifyResetToken(
      verifyResetTokenDto.userId,
      verifyResetTokenDto.token,
    );

    return {
      status: 'success',
      message: 'Token is valid',
      data: { valid: isValid },
    };
  }

  @Post('resetPassword')
  @HttpCode(HttpStatus.OK)
  @Public()
  @ApiOperation({ summary: 'Reset password using valid token' })
  @ApiResponse({
    status: 200,
    description: 'Password successfully reset',
    schema: {
      example: {
        status: 'success',
        message: 'Password has been reset successfully',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Token invalid or expired' })
  @ApiResponse({ status: 400, description: 'Invalid password format' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    // First verify the token is valid
    await this.passwordService.verifyResetToken(resetPasswordDto.userId, resetPasswordDto.token);

    // Then reset the password
    await this.passwordService.resetPassword(resetPasswordDto.userId, resetPasswordDto.newPassword);

    return {
      status: 'success',
      message: 'Password has been reset successfully. You can now login with your new password.',
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
  public async googleRedirect(@Req() req: RequestWithUser, @Res() res: Response) {
    const { accessToken, ...user } = await this.authService.login(req.user.sub, req.user.username);
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
                  url: '${
                    process.env.NODE_ENV === 'dev'
                      ? process.env.FRONTEND_URL
                      : process.env.FRONTEND_URL_PROD
                  }'/home',
                  user: ${JSON.stringify(req.user)}
                }
              },
              '${
                process.env.NODE_ENV === 'dev'
                  ? process.env.FRONTEND_URL
                  : process.env.FRONTEND_URL_PROD
              }'
            );
            window.close();
          </script>
        </body>
      </html>
    `;
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  @Get('github/login')
  @Public()
  @UseGuards(GithubAuthGuard)
  public githubLogin() {}

  @Get('github/redirect')
  @Public()
  @UseGuards(GithubAuthGuard)
  public async githubRedirect(@Req() req: RequestWithUser, @Res() res: Response) {
    const { accessToken, ...user } = await this.authService.login(req.user.sub, req.user.username);
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
                  url: '${
                    process.env.NODE_ENV === 'dev'
                      ? process.env.FRONTEND_URL
                      : process.env.FRONTEND_URL_PROD
                  }'/home',
                  user: ${JSON.stringify(req.user)}
                }
              },
              '${
                process.env.NODE_ENV === 'dev'
                  ? process.env.FRONTEND_URL
                  : process.env.FRONTEND_URL_PROD
              }'
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

  @Patch('update-email')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Update user email',
    description: 'Updates the email address of the currently authenticated user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Email updated successfully',
    type: ApiResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Token missing or invalid',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Email already in use',
    type: ErrorResponseDto,
  })
  public async updateEmail(@CurrentUser() user: any, @Body() updateEmailDto: UpdateEmailDto) {
    await this.authService.updateEmail(user.id, updateEmailDto.email);
    return {
      status: 'success',
      message: 'Email updated successfully. Please verify your new email.',
    };
  }

  @Patch('update-username')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Update username',
    description: 'Updates the username of the currently authenticated user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Username updated successfully',
    type: ApiResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Token missing or invalid',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Username already taken',
    type: ErrorResponseDto,
  })
  public async updateUsername(
    @CurrentUser() user: any,
    @Body() updateUsernameDto: UpdateUsernameDto,
  ) {
    await this.authService.updateUsername(user.id, updateUsernameDto.username);
    return {
      status: 'success',
      message: 'Username updated successfully',
    };
  }
}
