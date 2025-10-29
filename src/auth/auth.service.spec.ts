import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { CreateUserDto } from '../user/dto/create-user.dto';

describe('AuthService', () => {
  let authService: AuthService;
  let userService: UserService;

  const createUserDto: CreateUserDto = {
    email: 'test@example.com',
    password: 'password123',
    name: 'Test User',
    birthDate: new Date(),
  };

  const mockUser = {
    id: 1,
    email: 'test@example.com',
    name: 'Test User',
    password: 'hashedPassword',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUserService = {
    findByEmail: jest.fn(),
    create: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    userService = module.get<UserService>(UserService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(authService).toBeDefined();
    expect(userService).toBeDefined();
  });

  describe('registerUser', () => {
    it('should register a new user successfully', async () => {
      mockUserService.findByEmail.mockResolvedValue(null);
      mockUserService.create.mockResolvedValue(mockUser);

      const result = await authService.registerUser(createUserDto);

      expect(result).toEqual(mockUser);
    });

    it('should throw an error when user already exists', async () => {
      mockUserService.findByEmail.mockResolvedValue(mockUser);

      await expect(authService.registerUser(createUserDto)).rejects.toThrow(BadRequestException);
    });
  });
});
