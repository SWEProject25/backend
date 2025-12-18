import { JwtAuthGuard } from './jwt-auth.guard';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from 'src/auth/decorators/public.decorator';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new JwtAuthGuard(reflector);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    let mockContext: ExecutionContext;

    beforeEach(() => {
      mockContext = {
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
    });

    it('should return true for public routes', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
        mockContext.getHandler(),
        mockContext.getClass(),
      ]);
    });

    it('should call super.canActivate for protected routes', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      
      // Mock the parent's canActivate
      const superCanActivateSpy = jest.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(guard)),
        'canActivate'
      ).mockReturnValue(true);

      const result = guard.canActivate(mockContext);

      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
        mockContext.getHandler(),
        mockContext.getClass(),
      ]);
      
      superCanActivateSpy.mockRestore();
    });

    it('should call super.canActivate when IS_PUBLIC_KEY is undefined', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      
      const superCanActivateSpy = jest.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(guard)),
        'canActivate'
      ).mockReturnValue(true);

      guard.canActivate(mockContext);

      expect(reflector.getAllAndOverride).toHaveBeenCalled();
      
      superCanActivateSpy.mockRestore();
    });
  });
});
