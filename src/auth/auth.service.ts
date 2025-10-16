import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { UserService } from '../user/user.service';
import * as argon2 from 'argon2';
import { AuthJwtPayload } from 'src/types/jwtPayload';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';
import * as ms from 'ms';
import { PrismaService } from 'src/prisma/prisma.service';
import { generateOtp } from 'src/utils/otp.util';
import { hash } from 'argon2';
import { EmailService } from 'src/email/email.service';
import { readFileSync } from 'fs';
import { join } from 'path';

@Injectable()
export class AuthService {
  private readonly minRequestIntervalMinutes = 1;
  private readonly tokenExpirationMinutes = 15;

  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly prismaService: PrismaService,
    private readonly emailService: EmailService,
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

  public async login(userId: string, username: string) {
    const accessToken = await this.generateTokens(userId, username);
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
    // console.log(user);
    const isMatched = await this.verifyPassword(user.password, password);
    if (!isMatched) {
      throw new UnauthorizedException('Invalid credentials');
    }
    // return to req.user
    return {
      sub: user.id,
      username: user.username,
      // role: user.role,
    };
  }

  public async validateUserJwt(userId: string) {
    const user = await this.userService.findOne(userId);
    if (!user) {
      throw new UnauthorizedException('Invalid Credentials');
    }
    return user;
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

  public async generateOtp(userId: string, size = 6): Promise<string> {
    const recentToken = await this.prismaService.emailVerification.findFirst({
      where: {
        userId,
        created_at: {
          gt: new Date(Date.now() - this.minRequestIntervalMinutes * 60 * 1000),
        },
      },
    });
    if (recentToken) {
      throw new UnprocessableEntityException(
        'Please wait a minute before requesting a new token.',
      );
    }
    const otp = generateOtp(size);
    const hashedToken = await hash(otp);
    const token = await this.prismaService.emailVerification.create({
      data: {
        userId,
        token: hashedToken,
        expires_at: new Date(
          Date.now() + this.tokenExpirationMinutes * 60 * 1000,
        ),
      },
    });
    console.log(token);

    return otp;
  }

  public async validateOtp(userId: string, token: string): Promise<boolean> {
    const validToken = await this.prismaService.emailVerification.findFirst({
      where: { userId, expires_at: { gt: new Date(Date.now()) } },
    });
    if (validToken && (await argon2.verify(validToken.token, token))) {
      await this.prismaService.emailVerification.delete({
        where: { id: validToken.id },
      });
      return true;
    }
    return false;
  }

  public async generateVerificationEmail(userId: string) {
    const user = await this.userService.findOne(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.is_verified) {
      throw new UnprocessableEntityException('Account already verified');
    }
    const otp = await this.generateOtp(userId);
    const templatePath = join(
      process.cwd(), // always points to your project root
      'src', // or 'dist' after build, see below
      'email',
      'templates',
      'email-verification.html',
    );
    let template = readFileSync(templatePath, 'utf-8');
    template = template.replace('{{verificationCode}}', otp);

    await this.emailService.sendEmail({
      subject: 'Account Verification',
      recipients: [user.email],
      html: template,
    });
  }

  private async generateTokens(userId: string, username: string) {
    const payload: AuthJwtPayload = { sub: userId, username };
    const [accessToken] = await Promise.all([
      this.jwtService.signAsync(payload),
    ]);
    return accessToken;
  }

  public async verifyEmailOtp(userId: string, otp: string): Promise<boolean> {
    const user = await this.userService.findOne(userId);
    if (!user) {
      throw new UnprocessableEntityException('failed');
    }

    if (user.is_verified) {
      throw new UnprocessableEntityException('Account already verified');
    }
    const isValid = await this.validateOtp(userId, otp);
    if (!isValid) {
      throw new UnprocessableEntityException('failed');
    }
    user.is_verified = true;
    return true;
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
