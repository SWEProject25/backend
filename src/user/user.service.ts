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
  public async create(
    createUserDto: CreateUserDto,
    isVerified: boolean,
    oauthData?: Partial<OAuthProfileDto>,
  ) {
    const { password, name, birthDate, ...userData } = createUserDto;
    const hashedPassword = await hash(password);
    let username = generateUsername(name);
    while (await this.checkUsername(username)) {
      username = generateUsername(name);
    }
    return await this.prismaService.user.create({
      data: {
        ...userData,
        password: hashedPassword,
        username,
        is_verified: isVerified,
        ...(oauthData?.providerId && {
          provider_id: oauthData.providerId,
        }),
        Profile: {
          create: {
            name,
            ...(birthDate && { birth_date: birthDate }),
            ...(oauthData?.profileImageUrl && {
              profile_image_url: oauthData.profileImageUrl,
            }),
          },
        },
      },
      include: {
        Profile: true,
      },
    });
  }

  public async findByEmail(email: string) {
    return await this.prismaService.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        is_verified: true,
        password: true,
        Profile: {
          select: {
            name: true,
            profile_image_url: true,
            birth_date: true,
          },
        },
        deleted_at: true,
        has_completed_following: true,
        has_completed_interests: true,
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
        is_verified: true,
        Profile: {
          select: {
            name: true,
            profile_image_url: true,
            birth_date: true,
          },
        },
        deleted_at: true,
        has_completed_following: true,
        has_completed_interests: true,
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
    // Generate a unique email for providers that don't provide one (like GitHub without email scope)
    let email = oauthProfileDto.email;
    if (!email) {
      // Use provider-specific format to avoid conflicts
      email = `${oauthProfileDto.providerId}@${oauthProfileDto.provider}.oauth`;
    }

    const newUser = await this.prismaService.user.create({
      data: {
        email,
        password: '',
        username: oauthProfileDto.username!,
        is_verified: true,
        provider_id: oauthProfileDto.providerId,
      },
    });

    // Use displayName if available, otherwise fallback to username
    const displayName = oauthProfileDto.displayName || oauthProfileDto.username || 'User';

    const proflie = await this.prismaService.profile.create({
      data: {
        user_id: newUser.id,
        name: displayName,
        profile_image_url: oauthProfileDto?.profileImageUrl,
      },
    });
    return {
      newUser,
      proflie,
    };
  }

  public async findByProviderId(providerId: string) {
    return await this.prismaService.user.findFirst({
      where: {
        provider_id: providerId,
      },
      include: {
        Profile: true,
      },
    });
  }

  public async updateOAuthData(userId: number, providerId: string, email?: string) {
    // Generate synthetic email if not provided
    const updateData: any = {
      provider_id: providerId,
    };

    // Only update email if provided and it's not empty
    if (email) {
      updateData.email = email;
    }

    return await this.prismaService.user.update({
      where: { id: userId },
      data: updateData,
    });
  }

  public async getUserData(uniqueIdentifier: string) {
    // Simple email check to avoid ReDoS vulnerability from regex backtracking
    const atIndex = uniqueIdentifier.indexOf('@');
    const isEmail = atIndex > 0 && 
                    uniqueIdentifier.indexOf('.', atIndex) > atIndex + 1 && 
                    !uniqueIdentifier.includes(' ');
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

  public async getActiveUsers(): Promise<Array<{ id: number }>> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // the last 30 days

    return this.prismaService.user.findMany({
      where: {
        has_completed_interests: true,
        deleted_at: null,
        OR: [
          { Posts: { some: { created_at: { gte: thirtyDaysAgo } } } },
          { likes: { some: { created_at: { gte: thirtyDaysAgo } } } },
          { Following: { some: { createdAt: { gte: thirtyDaysAgo } } } },
        ],
      },
      select: { id: true },
      take: 1000,
    });
  }
}
