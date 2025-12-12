import { Test, TestingModule } from '@nestjs/testing';
import { SocketService } from './socket.service';
import { SocketGateway } from './socket.gateway';

describe('SocketService', () => {
  let service: SocketService;
  let socketGateway: jest.Mocked<SocketGateway>;

  const mockSocketGateway = {
    emitPostStatsUpdate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocketService,
        {
          provide: SocketGateway,
          useValue: mockSocketGateway,
        },
      ],
    }).compile();

    service = module.get<SocketService>(SocketService);
    socketGateway = module.get(SocketGateway);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  describe('emitPostStatsUpdate', () => {
    it('should delegate likeUpdate to socket gateway', () => {
      service.emitPostStatsUpdate(1, 'likeUpdate', 10);

      expect(mockSocketGateway.emitPostStatsUpdate).toHaveBeenCalledWith(1, 'likeUpdate', 10);
    });

    it('should delegate repostUpdate to socket gateway', () => {
      service.emitPostStatsUpdate(2, 'repostUpdate', 5);

      expect(mockSocketGateway.emitPostStatsUpdate).toHaveBeenCalledWith(2, 'repostUpdate', 5);
    });

    it('should delegate commentUpdate to socket gateway', () => {
      service.emitPostStatsUpdate(3, 'commentUpdate', 15);

      expect(mockSocketGateway.emitPostStatsUpdate).toHaveBeenCalledWith(3, 'commentUpdate', 15);
    });

    it('should handle zero count', () => {
      service.emitPostStatsUpdate(1, 'likeUpdate', 0);

      expect(mockSocketGateway.emitPostStatsUpdate).toHaveBeenCalledWith(1, 'likeUpdate', 0);
    });

    it('should handle large postId and count values', () => {
      service.emitPostStatsUpdate(999999, 'repostUpdate', 1000000);

      expect(mockSocketGateway.emitPostStatsUpdate).toHaveBeenCalledWith(
        999999,
        'repostUpdate',
        1000000,
      );
    });
  });
});
