import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { UserService } from '../user/user.service';
import { AuthJwtPayload } from 'src/types/jwtPayload';
import { PasswordService } from './services/password/password.service';
import { JwtTokenService } from './services/jwt-token/jwt-token.service';
import { Services } from 'src/utils/constants';
import { OAuthProfileDto } from './dto/oauth-profile.dto';
import { RedisService } from 'src/redis/redis.service';

const ISVERIFIED_CACHE_PREFIX = 'verified:';

@Injectable()
export class AuthService {
  constructor(
    @Inject(Services.USER)
    private readonly userService: UserService,
    @Inject(Services.PASSWORD)
    private readonly passwordService: PasswordService,
    @Inject(Services.JWT_TOKEN)
    private readonly jwtTokenService: JwtTokenService,
    @Inject(Services.REDIS)
    private readonly redisService: RedisService,
  ) {}

  public async registerUser(createUserDto: CreateUserDto) {
    const existingUser = await this.userService.findByEmail(createUserDto.email);
    if (existingUser) {
      throw new ConflictException('User is already exists');
    }
    const isVerified = await this.redisService.get(
      `${ISVERIFIED_CACHE_PREFIX}${createUserDto.email}`,
    );
    if (!isVerified) {
      throw new BadRequestException('Account is not verified, please verify the email first');
    }
    const user = this.userService.create(createUserDto, isVerified === 'true');

    await this.redisService.del(`${ISVERIFIED_CACHE_PREFIX}${createUserDto.email}`);
    return user;
  }

  public async checkEmailExistence(email: string): Promise<void> {
    const existingUser = await this.userService.findByEmail(email);

    if (existingUser) {
      throw new ConflictException('User already exists with this email');
    }
  }

  public async login(userId: number, username: string) {
    const userData = await this.userService.findOne(userId);

    if (!userData) {
      throw new UnauthorizedException('User not found');
    }
    if (userData.deleted_at) {
      throw new UnauthorizedException('Account has been deleted');
    }

    console.log(userData);
    const accessToken = await this.jwtTokenService.generateAccessToken(userId, username);
    return {
      user: {
        id: userId,
        username,
        email: userData.email,
        role: userData.role,
        profile: userData.Profile
          ? {
              name: userData.Profile.name,
              profileImageUrl: userData.Profile.profile_image_url,
              birthDate: userData.Profile?.birth_date,
            }
          : null,
      },
      onboarding: {
        hasCompeletedFollowing: userData.has_completed_following,
        hasCompeletedInterests: userData.has_completed_interests,
      },
      accessToken,
    };
  }

  public async validateLocalUser(email: string, password: string): Promise<AuthJwtPayload> {
    const user = await this.userService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.deleted_at) {
      throw new UnauthorizedException('Account has been deleted');
    }

    if (!user.is_verified) {
      throw new UnauthorizedException('Please verify your email before logging in');
    }

    const isPasswordValid = await this.passwordService.verify(user.password, password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const userData = await this.userService.getUserData(email);

    if (userData?.profile && userData?.user) {
      return {
        sub: userData.user.id,
        username: userData.user.username,
        role: userData.user.role,
        email: userData.user.email!,
        name: userData.profile.name,
        profileImageUrl: userData.profile.profile_image_url!,
      };
    }
    // return to req.user
    return {
      sub: user.id,
      username: user.username,
      role: user.role,
    };
  }

  public async validateUserJwt(userId: number) {
    const user = await this.userService.findOne(userId);

    if (!user) {
      throw new UnauthorizedException('Invalid Credentials');
    }

    if (user.deleted_at) {
      throw new UnauthorizedException('Account has been deleted');
    }

    return {
      id: userId,
      username: user.username,
      role: user.role,
      email: user.email,
      name: user.Profile?.name,
      profileImageUrl: user.Profile?.profile_image_url,
    };
  }

  public async validateGoogleUser(googleUser: CreateUserDto) {
    const email = googleUser.email;
    const existingUser = await this.userService.getUserData(email);
    if (existingUser?.user && existingUser?.profile) {
      return {
        sub: existingUser.user.id,
        username: existingUser.user.username,
        role: existingUser.user.role,
        email: existingUser.user.email,
        name: existingUser.profile.name,
        profileImageUrl: existingUser.profile.profile_image_url,
      };
    }
    const newUser = await this.userService.create(googleUser, true);
    const user = {
      sub: newUser.newUser.id,
      username: newUser.newUser.username,
      role: newUser.newUser.role,
      email: newUser.newUser.email,
      name: newUser.userProfile.name,
      profileImageUrl: newUser.userProfile.profile_image_url,
    };
    return user;
  }

  public async validateGithubUser(githubUserData: OAuthProfileDto) {
    // Debug logging
    console.log('[GitHub OAuth] Validating user with data:', {
      username: githubUserData.username,
      providerId: githubUserData.providerId,
      email: githubUserData.email || 'NO EMAIL',
    });

    // First, check if user exists by provider_id (most reliable for OAuth)
    const existingUserByProvider = await this.userService.findByProviderId(
      githubUserData.providerId,
    );
    console.log('[GitHub OAuth] User found by provider_id:', !!existingUserByProvider);

    if (existingUserByProvider) {
      return {
        sub: existingUserByProvider.id,
        username: existingUserByProvider.username,
        role: existingUserByProvider.role,
        email: existingUserByProvider.email,
        name: existingUserByProvider.Profile?.name,
        profileImageUrl: existingUserByProvider.Profile?.profile_image_url,
      };
    }

    // Check by email if provided (to link existing accounts)
    if (githubUserData.email) {
      const existingUserByEmail = await this.userService.getUserData(githubUserData.email);
      console.log('[GitHub OAuth] User found by email:', !!existingUserByEmail?.user);

      if (existingUserByEmail?.user && existingUserByEmail?.profile) {
        // Link GitHub OAuth to existing account
        if (!existingUserByEmail.user.provider_id) {
          console.log('[GitHub OAuth] Linking GitHub OAuth to existing account');
          await this.userService.updateOAuthData(
            existingUserByEmail.user.id,
            githubUserData.providerId,
            githubUserData.email,
          );
        }

        return {
          sub: existingUserByEmail.user.id,
          username: existingUserByEmail.user.username,
          role: existingUserByEmail.user.role,
          email: existingUserByEmail.user.email,
          name: existingUserByEmail.profile.name,
          profileImageUrl: existingUserByEmail.profile.profile_image_url,
        };
      }
    }

    // Check by username (for backwards compatibility with old OAuth users)
    const existingUser = await this.userService.getUserData(githubUserData.username!);
    console.log('[GitHub OAuth] User found by username:', !!existingUser?.user);

    if (existingUser?.user && existingUser?.profile) {
      // If user exists but doesn't have provider_id set, update it (migration path)
      if (!existingUser.user.provider_id) {
        await this.userService.updateOAuthData(
          existingUser.user.id,
          githubUserData.providerId,
          githubUserData.email,
        );
      }

      return {
        sub: existingUser.user.id,
        username: existingUser.user.username,
        role: existingUser.user.role,
        email: existingUser.user.email,
        name: existingUser.profile.name,
        profileImageUrl: existingUser.profile.profile_image_url,
      };
    }

    // Create new user if none exists
    console.log('[GitHub OAuth] Creating new user - no existing user found');
    const newUser = await this.userService.createOAuthUser(githubUserData);
    return {
      sub: newUser.newUser.id,
      username: newUser.newUser.username,
      role: newUser.newUser.role,
      email: newUser.newUser.email,
      name: newUser.proflie.name,
      profileImageUrl: newUser.proflie.profile_image_url,
    };
  }
  public async updateEmail(userId: number, email: string): Promise<void> {
    const existingUser = await this.userService.findByEmail(email);

    if (existingUser && existingUser.id !== userId) {
      throw new ConflictException('Email is already in use by another user');
    }

    await this.userService.updateEmail(userId, email);
  }

  public async updateUsername(userId: number, username: string): Promise<void> {
    const existingUser = await this.userService.findByUsername(username);

    if (existingUser && existingUser.id !== userId) {
      throw new ConflictException('Username is already taken');
    }

    await this.userService.updateUsername(userId, username);
  }
}
