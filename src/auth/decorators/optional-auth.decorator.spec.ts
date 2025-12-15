import { Reflector } from '@nestjs/core';
import { OptionalAuth, IS_OPTIONAL_AUTH_KEY } from './optional-auth.decorator';

describe('OptionalAuth Decorator', () => {
  it('should set IS_OPTIONAL_AUTH_KEY metadata to true', () => {
    @OptionalAuth()
    class TestClass {}

    const reflector = new Reflector();
    const isOptionalAuth = reflector.get(IS_OPTIONAL_AUTH_KEY, TestClass);

    expect(isOptionalAuth).toBe(true);
  });

  it('should export IS_OPTIONAL_AUTH_KEY constant', () => {
    expect(IS_OPTIONAL_AUTH_KEY).toBe('IS_OPTIONAL_AUTH');
  });

  it('should work on methods', () => {
    class TestClass {
      @OptionalAuth()
      testMethod() {}
    }

    const reflector = new Reflector();
    const isOptionalAuth = reflector.get(IS_OPTIONAL_AUTH_KEY, TestClass.prototype.testMethod);

    expect(isOptionalAuth).toBe(true);
  });
});
