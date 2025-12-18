import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    service = module.get<PrismaService>(PrismaService);
  });

  afterEach(async () => {
    await service.onModuleDestroy();
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should connent to the database', async () => {
      const connectSpy = jest.spyOn(service, '$connect').mockResolvedValue();
      await service.onModuleInit();
      expect(connectSpy).toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy', () => {
    it('should disconnect from the datebase', async () => {
      const disconnectSpy = jest.spyOn(service, '$disconnect').mockResolvedValue();
      await service.onModuleDestroy();
      expect(disconnectSpy).toHaveBeenCalled();
    });
  });
});
