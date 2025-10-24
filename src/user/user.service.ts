import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { hash } from 'argon2';
import { UpdateUserDto } from './dto/update-user.dto';
import { Services } from 'src/utils/constants';
import { OAuthProfileDto } from 'src/auth/dto/oauth-profile.dto';
import { generateUsername } from 'src/utils/username.util';

@Injectable()
export class UserService {
  constructor(
    @Inject(Services.PRISMA)
    private readonly prismaService: PrismaService,
  ) {}
  public async create(createUserDto: CreateUserDto) {
    const { password, name, birth_date, ...user } = createUserDto;
    const hashedPassword = await hash(password);
    const username = generateUsername(name);
    const newUser = await this.prismaService.user.create({
      data: {
        ...user,
        password: hashedPassword,
        username,
        is_verified: true,
      },
    });
    const userProfile = await this.prismaService.profile.create({
      data: {
        user_id: newUser.id,
        birth_date,
        name,
      },
    });

    return {
      newUser,
      userProfile,
    };
  }

  public async findByEmail(email: string) {
    return await this.prismaService.user.findUnique({
      where: {
        email,
      },
    });
  }

  public async findOne(userId: string) {
    return await this.prismaService.user.findUnique({ where: { id: userId } });
  }

  public async updateEmailVerification(updateUserDto: UpdateUserDto) {
    return await this.prismaService.user.update({
      where: {
        email: updateUserDto.email,
      },
      data: {
        is_verified: updateUserDto.is_verified,
      },
    });
  }

  public async checkExistingOtp(email: string) {
    return await this.prismaService.emailVerification.findFirst({
      where: { user_email: email },
    });
  }

  public async deleteExistingOtp(email: string) {
    return await this.prismaService.emailVerification.delete({
      where: {
        user_email: email,
      },
    });
  }

  public async findByUsername(username: string) {
    return await this.prismaService.user.findUnique({ where: { username } });
  }

  public async createOAuthUser(oauthProfileDto: OAuthProfileDto) {
    const newUser = await this.prismaService.user.create({
      data: {
        email:
          oauthProfileDto.provider === 'google' ? oauthProfileDto.email : '',
        password: '',
        username: oauthProfileDto.username!,
        is_verified: true,
        provider_id: oauthProfileDto.providerId,
      },
    });
    const proflie = await this.prismaService.profile.create({
      data: {
        user_id: newUser.id,
        name: oauthProfileDto.displayName,
        profile_image_url: oauthProfileDto.profileImageUrl,
      },
    });
    return {
      newUser,
      proflie,
    };
  }

  public async getUserData(email: string) {
    const user = await this.prismaService.user.findUnique({
      where: {
        email,
      },
    });
    if (user) {
      const profile = await this.prismaService.profile.findUnique({
        where: {
          user_id: user.id,
        },
      });
      return {
        user,
        profile,
      };
    }
    return user;
  }
}
