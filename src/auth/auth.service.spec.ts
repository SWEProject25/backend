import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { Services } from 'src/utils/constants';

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

  const mockPasswordService = {
    hash: jest.fn(),
    compare: jest.fn(),
  };

  const mockJwtTokenService = {
    generateTokens: jest.fn(),
    verifyToken: jest.fn(),
  };

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: Services.AUTH,
          useClass: AuthService,
        },
        {
          provide: Services.USER,
          useValue: mockUserService,
        },
        {
          provide: Services.PASSWORD,
          useValue: mockPasswordService,
        },
        {
          provide: Services.JWT_TOKEN,
          useValue: mockJwtTokenService,
        },
        {
          provide: Services.REDIS,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    authService = module.get<AuthService>(Services.AUTH);
    userService = module.get<UserService>(Services.USER);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(authService).toBeDefined();
    expect(userService).toBeDefined();
  });

  describe('registerUser', () => {
    it('should register a new user successfully', async () => {
      mockUserService.findByEmail.mockResolvedValue(null);
      mockRedisService.get.mockResolvedValue('true'); // Mock isVerified
      mockUserService.create.mockResolvedValue(mockUser);

      const result = await authService.registerUser(createUserDto);

      expect(result).toEqual(mockUser);
    });

    it('should throw an error when user already exists', async () => {
      mockUserService.findByEmail.mockResolvedValue(mockUser);

      await expect(authService.registerUser(createUserDto)).rejects.toThrow(ConflictException);
    });
  });
});
