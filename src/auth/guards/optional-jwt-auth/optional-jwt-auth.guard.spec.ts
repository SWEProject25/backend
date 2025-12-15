import { ExecutionContext } from '@nestjs/common';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';

describe('OptionalJwtAuthGuard', () => {
  let guard: OptionalJwtAuthGuard;

  beforeEach(() => {
    guard = new OptionalJwtAuthGuard();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should call super.canActivate', () => {
      const mockContext = {
        getHandler: jest.fn().mockReturnValue(() => {}),
        getClass: jest.fn().mockReturnValue(class {}),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({}),
          getResponse: jest.fn().mockReturnValue({}),
        }),
        getType: jest.fn().mockReturnValue('http'),
        getArgs: jest.fn().mockReturnValue([]),
        getArgByIndex: jest.fn(),
        switchToRpc: jest.fn(),
        switchToWs: jest.fn(),
      } as unknown as ExecutionContext;

      const superCanActivateSpy = jest.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(guard)),
        'canActivate'
      ).mockReturnValue(true);

      guard.canActivate(mockContext);

      expect(superCanActivateSpy).toHaveBeenCalledWith(mockContext);
      superCanActivateSpy.mockRestore();
    });
  });

  describe('handleRequest', () => {
    const mockContext = {} as ExecutionContext;

    it('should return null when there is an error', () => {
      const err = new Error('Auth error');
      const user = { id: 1, email: 'test@test.com' };

      const result = guard.handleRequest(err, user, null, mockContext);

      expect(result).toBeNull();
    });

    it('should return null when user is null', () => {
      const result = guard.handleRequest(null, null, null, mockContext);

      expect(result).toBeNull();
    });

    it('should return null when user is undefined', () => {
      const result = guard.handleRequest(null, undefined, null, mockContext);

      expect(result).toBeNull();
    });

    it('should return user when user exists and no error', () => {
      const user = { id: 1, email: 'test@test.com' };

      const result = guard.handleRequest(null, user, null, mockContext);

      expect(result).toEqual(user);
    });

    it('should return null when both error and no user', () => {
      const err = new Error('Auth error');

      const result = guard.handleRequest(err, null, null, mockContext);

      expect(result).toBeNull();
    });

    it('should return user with full payload', () => {
      const user = {
        id: 1,
        email: 'test@test.com',
        username: 'testuser',
        role: 'user',
      };

      const result = guard.handleRequest(null, user, null, mockContext);

      expect(result).toEqual(user);
    });
  });
});
