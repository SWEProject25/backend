import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { UserService } from '../user/user.service';
import * as argon2 from 'argon2';
import { AuthJwtPayload } from 'src/types/jwtPayload';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';
import jwtConfig from './config/jwt.config';
import { ConfigType } from '@nestjs/config';
import * as ms from 'ms';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,
  ) {}
  public async registerUser(createUserDto: CreateUserDto) {
    const existingUser = await this.userService.findByEmail(
      createUserDto.email,
    );
    if (existingUser) {
      throw new ConflictException('User is already exists'); //Unable to create account with provided email
    }
    return this.userService.create(createUserDto);
  }

  public async checkEmailExistence(email: string): Promise<void> {
    const existingUser = await this.userService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('User already exists with this email');
    }
  }

  public async login(userId: number, name: string) {
    const accessToken = await this.generateTokens(userId, name);
    return {
      user: {
        id: userId,
        name,
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
    const isMatched = await this.verifyPassword(user.password, password);
    if (!isMatched) {
      throw new UnauthorizedException('Invalid credentials');
    }
    // return to req.user
    return {
      sub: user.id,
      name: user.name,
      // role: user.role,
    };
  }

  public async validateUserJwt(userId: number) {
    const user = await this.userService.findOne(userId);
    if (!user) {
      throw new UnauthorizedException('Invalid Credentials');
    }
    return {
      id: user.id,
      // role:user.role
    };
  }

  public setAuthCookies(res: Response, accessToken: string) {
    const expiresIn = (process.env.JWT_EXPIRES_IN || '1h') as ms.StringValue;
    const cookieOptions = {
      httpOnly: true,
      sameSite: 'strict' as const,
      secure: process.env.NODE_ENV === 'production',
      maxAge: ms(expiresIn),
    };
    res.cookie('access_token', accessToken, cookieOptions);
  }

  private async generateTokens(userId: number, name: string) {
    const payload: AuthJwtPayload = { sub: userId, name };
    const [accessToken] = await Promise.all([
      this.jwtService.signAsync(payload),
    ]);
    return accessToken;
  }

  private async verifyPassword(
    hashedPassword: string,
    password: string,
  ): Promise<boolean> {
    try {
      return await argon2.verify(hashedPassword, password);
    } catch (error) {
      console.error(error);
      return false;
    }
  }
}
