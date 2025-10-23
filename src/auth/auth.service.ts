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

  public async login(userId: number, username: string) {
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

    // return to req.user
    return {
      sub: user.id,
      username: user.username,
      // role: user.role,
    };
  }

  public async validateUserJwt(userId: number) {
    const user = await this.userService.findOne(userId);

    if (!user) {
      throw new UnauthorizedException('Invalid Credentials');
    }

    return user;
  }

  public async validateGoogleUser(googleUser: CreateUserDto) {
    const email = googleUser.email;
    const existingUser = await this.userService.findByEmail(email);
    // console.log('existing user from google', user);
    if (existingUser) {
      return existingUser;
    }
    const newUser = await this.userService.create(googleUser);
    const user = {
      username: newUser.newUser.username,
      role: newUser.newUser.role,
      email: newUser.newUser.email,
      name: newUser.userProfile.name,
      birth_date: newUser.userProfile.birth_date,
      profile_image_url: newUser.userProfile.profile_image_url,
      banner_image_url: newUser.userProfile.banner_image_url,
      bio: newUser.userProfile.bio,
      location: newUser.userProfile.location,
      website: newUser.userProfile.website,
      created_at: newUser.newUser.created_at,
    };
    console.log('validate google user');
    console.log(user);
    return user;
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
