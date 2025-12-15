import { Test, TestingModule } from '@nestjs/testing';
import { JwtTokenService } from './jwt-token.service';
import { JwtService } from '@nestjs/jwt';
import { Services } from 'src/utils/constants';
import { Response } from 'express';

describe('JwtTokenService', () => {
  let service: JwtTokenService;
  let mockJwtService: any;

  beforeEach(async () => {
    mockJwtService = {
      sign: jest.fn(),
      signAsync: jest.fn(),
      verify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: Services.JWT_TOKEN,
          useClass: JwtTokenService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<JwtTokenService>(Services.JWT_TOKEN);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateAccessToken', () => {
    it('should generate access token successfully', async () => {
      const userId = 1;
      const username = 'testuser';
      const expectedToken = 'mock.jwt.token';

      mockJwtService.signAsync.mockResolvedValue(expectedToken);

      const result = await service.generateAccessToken(userId, username);

      expect(result).toBe(expectedToken);
      expect(mockJwtService.signAsync).toHaveBeenCalledWith({
        sub: userId,
        username,
      });
    });
  });

  describe('setAuthCookies', () => {
    it('should set auth cookie with correct options', () => {
      const mockResponse = {
        cookie: jest.fn(),
      } as unknown as Response;

      const accessToken = 'mock.jwt.token';

      service.setAuthCookies(mockResponse, accessToken);

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'access_token',
        accessToken,
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'none',
          secure: true,
          path: '/',
        }),
      );
    });
  });

  describe('clearAuthCookies', () => {
    it('should clear auth cookie', () => {
      const mockResponse = {
        clearCookie: jest.fn(),
      } as unknown as Response;

      service.clearAuthCookies(mockResponse);

      expect(mockResponse.clearCookie).toHaveBeenCalledWith('access_token', {
        path: '/',
      });
    });
  });
});
