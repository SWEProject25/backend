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
  public async create(createUserDto: CreateUserDto, isVerified: boolean) {
    const { password, name, birthDate, ...user } = createUserDto;
    const hashedPassword = await hash(password);
    let username = generateUsername(name);
    while (await this.checkUsername(username)) {
      username = generateUsername(name);
    }
    const newUser = await this.prismaService.user.create({
      data: {
        ...user,
        password: hashedPassword,
        username,
        is_verified: isVerified,
      },
    });
    const userProfile = await this.prismaService.profile.create({
      data: {
        user_id: newUser.id,
        birth_date: birthDate,
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

  public async findOne(userId: number) {
    return await this.prismaService.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        username: true,
        role: true,
        Profile: {
          select: {
            name: true,
            profile_image_url: true,
          },
        },
      },
    });
  }

  public async findByUsername(username: string) {
    return await this.prismaService.user.findFirst({
      where: {
        username,
      },
    });
  }

  public async createOAuthUser(oauthProfileDto: OAuthProfileDto) {
    const newUser = await this.prismaService.user.create({
      data: {
        email: oauthProfileDto.provider === 'google' ? oauthProfileDto.email! : '',
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
        profile_image_url: oauthProfileDto?.profileImageUrl,
      },
    });
    return {
      newUser,
      proflie,
    };
  }

  public async getUserData(uniqueIdentifier: string) {
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(uniqueIdentifier);
    const user = await this.prismaService.user.findUnique({
      where: isEmail ? { email: uniqueIdentifier } : { username: uniqueIdentifier },
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
    return null;
  }

  public async updatePassword(userId: number, hashed: string) {
    return await this.prismaService.user.update({
      where: { id: userId },
      data: { password: hashed },
    });
  }
  async findById(id: number) {
    return await this.prismaService.user.findFirst({ where: { id } });
  }

  public async updateEmail(userId: number, email: string) {
    return await this.prismaService.user.update({
      where: {
        id: userId,
      },
      data: {
        email,
        is_verified: false,
      },
    });
  }

  public async updateUsername(userId: number, username: string) {
    return await this.prismaService.user.update({
      where: {
        id: userId,
      },
      data: {
        username,
      },
    });
  }

  public async checkUsername(username: string) {
    return await this.prismaService.user.findUnique({ where: { username } });
  }
}
