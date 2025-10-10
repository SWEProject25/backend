import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { hash } from 'argon2';

@Injectable()
export class UserService {
  public async create(createUserDto: CreateUserDto) {
    const { password, ...user } = createUserDto;
    const hashedPassword = await hash(password);
    return await this.prismaService.user.create({
      data: {
        password: hashedPassword,
        ...user,
      },
    });
  }
  constructor(private readonly prismaService: PrismaService) {}
  public async findByEmail(email: string) {
    return await this.prismaService.user.findUnique({
      where: {
        email,
      },
    });
  }
}
