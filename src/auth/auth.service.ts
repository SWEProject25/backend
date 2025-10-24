import {
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

@Injectable()
export class AuthService {
  constructor(
    @Inject(Services.USER)
    private readonly userService: UserService,
    @Inject(Services.PASSWORD)
    private readonly passwordService: PasswordService,
    @Inject(Services.JWT_TOKEN)
    private readonly jwtTokenService: JwtTokenService,
  ) {}

  public async registerUser(createUserDto: CreateUserDto) {
    const existingUser = await this.userService.findByEmail(
      createUserDto.email,
    );
    if (existingUser) {
      throw new ConflictException('User is already exists');
    }
    return this.userService.create(createUserDto);
  }

  public async checkEmailExistence(email: string): Promise<void> {
    const existingUser = await this.userService.findByEmail(email);

    if (existingUser) {
      throw new ConflictException('User already exists with this email');
    }
  }

  public async login(userId: string, username: string) {
    const accessToken = await this.jwtTokenService.generateAccessToken(
      userId,
      username,
    );

    return {
      user: {
        id: userId,
        username,
      },
      accessToken,
    };
  }

  public async validateLocalUser(
    email: string,
    password: string,
  ): Promise<AuthJwtPayload> {
    const user = await this.userService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await this.passwordService.verify(
      user.password,
      password,
    );

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

  public async validateUserJwt(userId: string) {
    const user = await this.userService.findOne(userId);

    if (!user) {
      throw new UnauthorizedException('Invalid Credentials');
    }

    return user;
  }

  public async validateGoogleUser(googleUser: CreateUserDto) {
    const email = googleUser.email;
    const existingUser = await this.userService.getUserData(email);
    if (existingUser?.user && existingUser?.profile) {
      return {
        username: existingUser.user.username,
        role: existingUser.user.role,
        email: existingUser.user.email,
        name: existingUser.profile.name,
        profileImageUrl: existingUser.profile.profile_image_url,
      };
    }
    const newUser = await this.userService.create(googleUser);
    const user = {
      username: newUser.newUser.username,
      role: newUser.newUser.role,
      email: newUser.newUser.email,
      name: newUser.userProfile.name,
      profileImageUrl: newUser.userProfile.profile_image_url,
    };
    return user;
  }

  public async validateGithubUser(githubUserData: OAuthProfileDto) {
    const existingUser = await this.userService.getUserData(
      githubUserData.username!,
    );
    // if (existingUser) {
    //   // @TODO check for provider
    //   return existingUser;
    // }
    if (existingUser?.user && existingUser?.profile) {
      return {
        username: existingUser.user.username,
        role: existingUser.user.role,
        email: existingUser.user.email,
        name: existingUser.profile.name,
        profileImageUrl: existingUser.profile.profile_image_url,
      };
    }
    const newUser = await this.userService.createOAuthUser(githubUserData);
    return {
      username: newUser.newUser.username,
      role: newUser.newUser.role,
      email: newUser.newUser.email,
      name: newUser.proflie.name,
      profileImageUrl: newUser.proflie.profile_image_url,
    };
  }
}
