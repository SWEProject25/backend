import { Reflector } from '@nestjs/core';
import { Public, IS_PUBLIC_KEY } from './public.decorator';

describe('Public Decorator', () => {
  it('should set IS_PUBLIC_KEY metadata to true', () => {
    @Public()
    class TestClass {}

    const reflector = new Reflector();
    const isPublic = reflector.get(IS_PUBLIC_KEY, TestClass);

    expect(isPublic).toBe(true);
  });

  it('should export IS_PUBLIC_KEY constant', () => {
    expect(IS_PUBLIC_KEY).toBe('IS_PUBLIC');
  });

  it('should work on methods', () => {
    class TestClass {
      @Public()
      testMethod() {}
    }

    const reflector = new Reflector();
    const isPublic = reflector.get(IS_PUBLIC_KEY, TestClass.prototype.testMethod);

    expect(isPublic).toBe(true);
  });
});
