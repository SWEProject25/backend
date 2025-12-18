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
  ApiQuery,
  ApiResponse,
  ApiTooManyRequestsResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { LocalAuthGuard } from './guards/local-auth/local-auth.guard';
import { Response } from 'express';
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
import { AuthenticatedUser } from './interfaces/user.interface';
import { ChangePasswordDto } from './dto/change-password.dto';
import { VerifyPasswordDto } from './dto/verify-password.dto';
import { UserService } from 'src/user/user.service';
import { GoogleMobileLoginDto } from './dto/google-mobile-login.dto';
import { ExchangeOAuthCodeDto } from './dto/exchange-oauth-code.dto';

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
    @Inject(Services.USER)
    private readonly userServivce: UserService,
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
    const user = await this.authService.registerUser(createUserDto);
    const accessToken = await this.jwtTokenService.generateAccessToken(user.id, user.username);
    this.jwtTokenService.setAuthCookies(res, accessToken);
    return {
      status: 'success',
      message: 'Account created successfully.',
      data: {
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          email: user.email,
          profile: {
            name: user.Profile?.name,
            profileImageUrl: user.Profile?.profile_image_url,
          },
        },
        onboardingStatus: {
          hasCompeletedFollowing: user.has_completed_following,
          hasCompeletedInterests: user.has_completed_interests,
          hasCompletedBirthDate: user.Profile?.birth_date !== null,
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
        user: result.user,
        onboardingStatus: result.onboarding,
      },
    };
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
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
  public async getMe(@CurrentUser() user: AuthenticatedUser) {
    const userData = await this.userServivce.findOne(user.id);
    return {
      status: 'success',
      data: {
        user: {
          id: user.id,
          username: userData?.username,
          role: userData?.role,
          email: userData?.email,
          profile: {
            name: userData?.Profile?.name,
            profileImageUrl: userData?.Profile?.profile_image_url,
            birthDate: userData?.Profile?.birth_date,
          },
        },
        onboardingStatus: {
          hasCompeletedFollowing: userData?.has_completed_following,
          hasCompeletedInterests: userData?.has_completed_interests,
          hasCompletedBirthDate: userData?.Profile?.birth_date !== null,
        },
      },
    };
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
      message: 'You will recieve verification code soon, Please check your email',
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
      message: 'You will recieve verification code soon, Please check your email',
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
  @ApiOperation({
    summary: 'Google OAuth callback',
    description:
      'Handles Google OAuth callback. For mobile apps (platform=mobile), returns a one-time code instead of tokens.',
  })
  @ApiQuery({
    name: 'platform',
    required: false,
    type: String,
    description: 'Platform type (web | mobile)',
  })
  public async googleRedirect(
    @Req() req: RequestWithUser,
    @Res() res: Response,
    @Query('state') platform: string,
  ) {
    const { accessToken, ...user } = await this.authService.login(
      req.user.sub ?? req.user?.id,
      req.user.username,
    );

    const resolvedPlatform: string = platform || 'web';

    if (resolvedPlatform === 'mobile') {
      const code = await this.authService.createOAuthCode(accessToken, user);
      const mobileDomain = process.env.MOBILE_APP_OAUTH_REDIRECT || 'myapp://oauth/callback';
      return res.redirect(`${mobileDomain}?code=${code}`);
    }

    this.jwtTokenService.setAuthCookies(res, accessToken);

    const html = `
      <!DOCTYPE html>
      <html lang="en">
        <body>
          <script>
            (function () {
              const frontendBase = "${
                process.env.NODE_ENV === 'dev'
                  ? process.env.FRONTEND_URL
                  : process.env.FRONTEND_URL_PROD
              }";
              const url = frontendBase + '/home';
              const user = ${JSON.stringify(user)};
              const message = {
                status: 'success',
                data: {
                  url: url,
                  user: user
                }
              };

              // Use exact origin (no wildcards) for security
              const targetOrigin = frontendBase;
              try {
                if (window.opener && !window.opener.closed) {
                  window.opener.postMessage(message, targetOrigin);
                  // Give the opener a moment to handle the message, then close the popup
                  setTimeout(() => window.close(), 100);
                } else {
                  console.warn('No opener window to receive OAuth message.');
                  // Redirect the popup to the frontend as a fallback
                  window.location.href = url;
                }
              } catch (err) {
                console.error('Failed to postMessage to opener:', err);
                // As a fallback we can redirect
                window.location.href = url;
              }
            })();
          </script>
        </body>
      </html>
    `;
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  @ApiOperation({
    summary: 'Google OAuth for mobile/cross-platform apps',
    description:
      'Authenticate users using Google ID token from mobile apps (Flutter, React Native, etc.).  The client performs OAuth flow and sends the ID token to this endpoint for verification.',
  })
  @ApiBody({
    type: GoogleMobileLoginDto,
    description: 'Google ID token obtained from client-side OAuth flow',
    examples: {
      example1: {
        summary: 'Valid ID token',
        value: {
          idToken: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjY4YWU1NDA.. .',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully authenticated with Google',
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          example: 'success',
        },
        data: {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                sub: { type: 'number', example: 1 },
                username: { type: 'string', example: 'mohamedalbaz492' },
                role: { type: 'string', example: 'user' },
                email: { type: 'string', example: 'mohamedalbaz492@gmail.com' },
                name: { type: 'string', example: 'Mohamed Albaz' },
                profileImageUrl: {
                  type: 'string',
                  example: 'https://lh3.googleusercontent.com/a/.. .',
                  nullable: true,
                },
              },
            },
            onboardingStatus: {
              properties: {
                hasCompeletedFollowing: { type: 'boolean', example: false },
                hasCompletedInterests: { type: 'boolean', example: false },
                hasCompletedFollowing: { type: 'boolean', example: false },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired Google ID token',
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          example: 'error',
        },
        message: {
          type: 'string',
          example: 'Invalid Google ID token: Wrong recipient, payload audience != requiredAudience',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - missing or invalid idToken',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'array',
          items: { type: 'string' },
          example: ['idToken should not be empty', 'idToken must be a string'],
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @Post('google/mobile')
  @Public()
  public async googleMobileLogin(
    @Body() googleLoginDto: GoogleMobileLoginDto,
    @Res() res: Response,
  ) {
    const { accessToken, result } = await this.authService.verifyGoogleIdToken(
      googleLoginDto.idToken,
    );
    this.jwtTokenService.setAuthCookies(res, accessToken);

    return res.json({
      status: 'success',
      data: {
        user: result.user,
        onboardingStatus: result.onboarding,
      },
    });
  }

  @ApiOperation({
    summary: 'GitHub OAuth Login',
    description:
      'Starts GitHub OAuth. Add ?platform=mobile if request is from a mobile app. Default = web.',
  })
  @ApiQuery({
    name: 'platform',
    required: false,
    type: String,
    example: 'mobile',
    description: 'Platform requesting OAuth (web | mobile). Default: web',
  })
  @Get('github/login')
  @Public()
  @UseGuards(GithubAuthGuard)
  public githubLogin() {
    // Passport guard redirect handles this - method intentionally empty
    return;
  }

  @Get('github/redirect')
  @Public()
  @UseGuards(GithubAuthGuard)
  @ApiOperation({
    summary: 'GitHub OAuth callback',
    description:
      'Handles GitHub OAuth callback. For mobile apps (platform=mobile), returns a one-time code instead of tokens.',
  })
  @ApiQuery({
    name: 'state',
    required: false,
    type: String,
    description: 'Platform type (web | mobile)',
  })
  public async githubRedirect(
    @Req() req: RequestWithUser,
    @Res() res: Response,
    @Query('state') platform: string,
  ) {
    const { accessToken, ...user } = await this.authService.login(req.user.sub, req.user.username);

    const resolvedPlatform: string = platform || 'web';

    if (resolvedPlatform === 'mobile') {
      const code = await this.authService.createOAuthCode(accessToken, user);
      const mobileDomain = process.env.MOBILE_APP_OAUTH_REDIRECT || 'myapp://oauth/callback';
      return res.redirect(`${mobileDomain}?code=${code}`);
    }

    this.jwtTokenService.setAuthCookies(res, accessToken);

    const html = `
      <!DOCTYPE html>
      <html lang="en">
        <body>
          <script>
            (function() {
              const frontendBase = "${
                process.env.NODE_ENV === 'dev'
                  ? process.env.FRONTEND_URL
                  : process.env.FRONTEND_URL_PROD
              }";
              const url = frontendBase + '/home';
              const user = ${JSON.stringify(user)};
              const message = {
                status: 'success',
                data: { url: url, user: user }
              };

              try {
                if (window.opener && !window.opener.closed) {
                  window.opener.postMessage(message, frontendBase);
                  setTimeout(() => window.close(), 100);
                } else {
                  window.location.href = url;
                }
              } catch (err) {
                console.error('Failed to postMessage to opener:', err);
                window.location.href = url;
              }
            })();
          </script>
        </body>
      </html>
    `;
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  @Post('oauth/exchange-code')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Exchange OAuth one-time code for tokens',
    description:
      'Mobile apps use this endpoint to exchange the one-time code received from OAuth callback for authentication tokens. The code is valid for 5 minutes and can only be used once.',
  })
  @ApiBody({
    type: ExchangeOAuthCodeDto,
    description: 'One-time code received from OAuth redirect',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully exchanged code for tokens',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        message: { type: 'string', example: 'Authentication successful' },
        data: {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                id: { type: 'number', example: 1 },
                username: { type: 'string', example: 'johndoe' },
                role: { type: 'string', example: 'USER' },
                email: { type: 'string', example: 'john@example.com' },
              },
            },
            onboarding: {
              type: 'object',
              properties: {
                hasCompeletedFollowing: { type: 'boolean', example: false },
                hasCompeletedInterests: { type: 'boolean', example: false },
                hasCompletedBirthDate: { type: 'boolean', example: false },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired code',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Invalid or expired OAuth code' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - missing or invalid code',
  })
  public async exchangeOAuthCode(
    @Body() exchangeCodeDto: ExchangeOAuthCodeDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const oauthData = await this.authService.exchangeCode(exchangeCodeDto.code);
    this.jwtTokenService.setAuthCookies(res, oauthData.accessToken);

    return {
      status: 'success',
      message: 'Authentication successful',
      data: {
        user: oauthData.user.user,
        onboarding: oauthData.user.onboarding,
      },
    };
  }

  @Get('test')
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Test endpoint',
    description: 'A protected test endpoint to verify JWT authentication.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successful test',
    type: ApiResponseDto,
  })
  public test() {
    return 'hello';
  }

  @Patch('update-email')
  @HttpCode(HttpStatus.OK)
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

  @Post('changePassword')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Change user password (requires authentication)' })
  @ApiResponse({
    status: 200,
    description: 'Password updated successfully',
    schema: {
      example: {
        status: 'success',
        message: 'Password updated successfully',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Old password is incorrect or same as new password',
    schema: {
      example: {
        statusCode: 400,
        message: 'Old password is incorrect',
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized (invalid or missing JWT token)',
    schema: {
      example: {
        statusCode: 401,
        message: 'Unauthorized',
      },
    },
  })
  public async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    await this.passwordService.changePassword(user.id, changePasswordDto);
    return {
      status: 'success',
      message: 'Password updated successfully',
    };
  }

  @Post('verifyPassword')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Verify user password',
    description:
      "Verifies if the provided password matches the current user's password. Used for re-authentication before sensitive operations.",
  })
  @ApiResponse({
    status: 200,
    description: 'Password verification completed',
    schema: {
      example: {
        status: 'success',
        data: {
          isValid: true,
        },
        message: 'Password is correct',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
    type: ErrorResponseDto,
  })
  async verifyPassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() verifyPasswordDto: VerifyPasswordDto,
  ) {
    const isValid = await this.passwordService.verifyCurrentPassword(
      user.id,
      verifyPasswordDto.password,
    );

    return {
      status: 'success',
      data: {
        isValid,
      },
      message: 'Correct Password',
    };
  }

  @Get('reset-mobile-password')
  @Public()
  async redirectToMobileApp(
    @Query('token') token: string,
    @Query('id') id: string,
    @Res() res: Response,
  ) {
    if (!token || !id) {
      return res.status(400).send('Invalid reset link');
    }

    const deepLink = `${process.env.MOBILE_APP_OAUTH_REDIRECT}?token=${token}&id=${id}`;
    console.log(deepLink);
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Opening Hankers App...</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background-color: #f5f8fa;
          }
          .container {
            text-align: center;
            padding: 40px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            max-width: 400px;
          }
          .spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #1da1f2;
            border-radius: 50%;
            width: 50px;
            height: 50px;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          h2 {
            color: #0f1419;
            margin-bottom: 10px;
            font-size: 24px;
          }
          p {
            color: #536471;
            font-size: 14px;
            line-height: 1.5;
          }
          .note {
            margin-top: 20px;
            font-size: 12px;
            color: #657786;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="spinner"></div>
          <h2>Opening Hankers App...</h2>
          <p>Redirecting you to the mobile app to reset your password.</p>
          <p class="note">If nothing happens, please make sure you have the Hankers app installed.</p>
        </div>
        
        <script>
          // Redirect to mobile app
          window.location.href = "${deepLink}";
        </script>
      </body>
      </html>
    `;

    return res.send(html);
  }
}
