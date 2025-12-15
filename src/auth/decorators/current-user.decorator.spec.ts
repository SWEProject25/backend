import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { CurrentUser } from './current-user.decorator';

describe('CurrentUser Decorator', () => {
  // Helper to get decorator factory
  function getParamDecoratorFactory(decorator: Function) {
    class TestClass {
      testMethod(@decorator() value: any) {}
    }

    const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, TestClass, 'testMethod');
    return args[Object.keys(args)[0]].factory;
  }

  function getParamDecoratorFactoryWithData(decorator: Function, data: any) {
    class TestClass {
      testMethod(@decorator(data) value: any) {}
    }

    const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, TestClass, 'testMethod');
    return args[Object.keys(args)[0]].factory;
  }

  it('should return full user when no data key specified', () => {
    const factory = getParamDecoratorFactory(CurrentUser);
    const mockUser = { id: 1, email: 'test@test.com', username: 'testuser' };
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: mockUser,
        }),
      }),
    } as unknown as ExecutionContext;

    const result = factory(undefined, mockContext);

    expect(result).toEqual(mockUser);
  });

  it('should return specific property when data key is specified', () => {
    class TestClass {
      testMethod(@CurrentUser('id') value: any) {}
    }

    const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, TestClass, 'testMethod');
    const factory = args[Object.keys(args)[0]].factory;

    const mockUser = { id: 1, email: 'test@test.com', username: 'testuser' };
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: mockUser,
        }),
      }),
    } as unknown as ExecutionContext;

    const result = factory('id', mockContext);

    expect(result).toBe(1);
  });

  it('should return email property when email key is specified', () => {
    class TestClass {
      testMethod(@CurrentUser('email') value: any) {}
    }

    const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, TestClass, 'testMethod');
    const factory = args[Object.keys(args)[0]].factory;

    const mockUser = { id: 1, email: 'test@test.com', username: 'testuser' };
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: mockUser,
        }),
      }),
    } as unknown as ExecutionContext;

    const result = factory('email', mockContext);

    expect(result).toBe('test@test.com');
  });

  it('should handle undefined user gracefully', () => {
    const factory = getParamDecoratorFactory(CurrentUser);
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: undefined,
        }),
      }),
    } as unknown as ExecutionContext;

    const result = factory(undefined, mockContext);

    expect(result).toBeUndefined();
  });
});
