import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { hash } from 'argon2';

@Injectable()
export class UserService {
  constructor(private readonly prismaService: PrismaService) {}
  public async create(createUserDto: CreateUserDto) {
    const { password, name, birth_date, ...user } = createUserDto;
    const hashedPassword = await hash(password);
    const username = 'temp'; // @TODO changed to unique identifer for each user
    const newUser = await this.prismaService.user.create({
      data: {
        ...user,
        password: hashedPassword,
        username,
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
}
