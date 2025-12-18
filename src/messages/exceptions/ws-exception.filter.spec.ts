import { ArgumentsHost } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { WebSocketExceptionFilter } from './ws-exception.filter';
import { Socket } from 'socket.io';

describe('WebSocketExceptionFilter', () => {
  let filter: WebSocketExceptionFilter;
  let mockClient: Partial<Socket>;
  let mockHost: Partial<ArgumentsHost>;

  beforeEach(() => {
    filter = new WebSocketExceptionFilter();

    mockClient = {
      emit: jest.fn(),
    };

    mockHost = {
      switchToWs: jest.fn().mockReturnValue({
        getClient: jest.fn().mockReturnValue(mockClient),
      }),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('catch', () => {
    it('should emit error with WsException message', () => {
      const exception = new WsException('WebSocket error message');

      filter.catch(exception, mockHost as ArgumentsHost);

      expect(mockClient.emit).toHaveBeenCalledWith('error', {
        status: 'error',
        message: 'WebSocket error message',
        timestamp: expect.any(String),
      });
    });

    it('should emit error with generic Error message', () => {
      const exception = new Error('Generic error');

      filter.catch(exception, mockHost as ArgumentsHost);

      expect(mockClient.emit).toHaveBeenCalledWith('error', {
        status: 'error',
        message: 'Generic error',
        timestamp: expect.any(String),
      });
    });

    it('should emit error with string exception', () => {
      const exception = 'String error';

      filter.catch(exception, mockHost as ArgumentsHost);

      expect(mockClient.emit).toHaveBeenCalledWith('error', {
        status: 'error',
        message: 'String error',
        timestamp: expect.any(String),
      });
    });

    it('should emit error with object having message property', () => {
      const exception = { message: 'Object error message' };

      filter.catch(exception, mockHost as ArgumentsHost);

      expect(mockClient.emit).toHaveBeenCalledWith('error', {
        status: 'error',
        message: 'Object error message',
        timestamp: expect.any(String),
      });
    });

    it('should emit default error message for unknown exception', () => {
      const exception = { foo: 'bar' };

      filter.catch(exception, mockHost as ArgumentsHost);

      expect(mockClient.emit).toHaveBeenCalledWith('error', {
        status: 'error',
        message: 'An unexpected error occurred',
        timestamp: expect.any(String),
      });
    });

    it('should emit default error message for null exception', () => {
      filter.catch(null, mockHost as ArgumentsHost);

      expect(mockClient.emit).toHaveBeenCalledWith('error', {
        status: 'error',
        message: 'An unexpected error occurred',
        timestamp: expect.any(String),
      });
    });

    it('should emit default error message for undefined exception', () => {
      filter.catch(undefined, mockHost as ArgumentsHost);

      expect(mockClient.emit).toHaveBeenCalledWith('error', {
        status: 'error',
        message: 'An unexpected error occurred',
        timestamp: expect.any(String),
      });
    });

    it('should handle WsException with object error', () => {
      const wsException = new WsException({ message: 'Complex WsException' });

      filter.catch(wsException, mockHost as ArgumentsHost);

      expect(mockClient.emit).toHaveBeenCalledWith('error', {
        status: 'error',
        message: 'Complex WsException',
        timestamp: expect.any(String),
      });
    });
  });
});
