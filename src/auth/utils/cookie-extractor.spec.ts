import { Request } from 'express';
import { cookieExtractor } from './cookie-extractor';

describe('cookieExtractor', () => {
  describe('basic functionality', () => {
    it('should return a function', () => {
      const extractor = cookieExtractor('test-cookie');
      expect(typeof extractor).toBe('function');
    });

    it('should extract cookie value when cookie exists', () => {
      const extractor = cookieExtractor('access_token');
      const mockRequest = {
        cookies: { access_token: 'test-token-value' },
      } as Partial<Request> as Request;

      const result = extractor(mockRequest);
      expect(result).toBe('test-token-value');
    });

    it('should return null when cookie does not exist', () => {
      const extractor = cookieExtractor('access_token');
      const mockRequest = {
        cookies: { other_cookie: 'value' },
      } as Partial<Request> as Request;

      const result = extractor(mockRequest);
      expect(result).toBeNull();
    });

    it('should return null when cookies object is empty', () => {
      const extractor = cookieExtractor('access_token');
      const mockRequest = {
        cookies: {},
      } as Partial<Request> as Request;

      const result = extractor(mockRequest);
      expect(result).toBeNull();
    });

    it('should return null when cookies is undefined', () => {
      const extractor = cookieExtractor('access_token');
      const mockRequest = {} as Partial<Request> as Request;

      const result = extractor(mockRequest);
      expect(result).toBeNull();
    });

    it('should return null when request is undefined', () => {
      const extractor = cookieExtractor('access_token');
      const result = extractor(undefined as any);
      expect(result).toBeNull();
    });
  });

  describe('cookie name specificity', () => {
    it('should extract correct cookie by name when multiple cookies exist', () => {
      const extractor = cookieExtractor('target_cookie');
      const mockRequest = {
        cookies: {
          cookie1: 'value1',
          target_cookie: 'target_value',
          cookie2: 'value2',
        },
      } as Partial<Request> as Request;

      const result = extractor(mockRequest);
      expect(result).toBe('target_value');
    });

    it('should handle different cookie names independently', () => {
      const extractor1 = cookieExtractor('cookie1');
      const extractor2 = cookieExtractor('cookie2');

      const mockRequest = {
        cookies: {
          cookie1: 'value1',
          cookie2: 'value2',
        },
      } as Partial<Request> as Request;

      expect(extractor1(mockRequest)).toBe('value1');
      expect(extractor2(mockRequest)).toBe('value2');
    });

    it('should handle special characters in cookie names', () => {
      const extractor = cookieExtractor('my-special_cookie.name');
      const mockRequest = {
        cookies: { 'my-special_cookie.name': 'special-value' },
      } as Partial<Request> as Request;

      const result = extractor(mockRequest);
      expect(result).toBe('special-value');
    });
  });

  describe('type safety', () => {
    it('should return null when cookie value is not a string (number)', () => {
      const extractor = cookieExtractor('numeric_cookie');
      const mockRequest = {
        cookies: { numeric_cookie: 123 },
      } as Partial<Request> as Request;

      const result = extractor(mockRequest);
      expect(result).toBeNull();
    });

    it('should return null when cookie value is not a string (boolean)', () => {
      const extractor = cookieExtractor('boolean_cookie');
      const mockRequest = {
        cookies: { boolean_cookie: true },
      } as Partial<Request> as Request;

      const result = extractor(mockRequest);
      expect(result).toBeNull();
    });

    it('should return null when cookie value is not a string (object)', () => {
      const extractor = cookieExtractor('object_cookie');
      const mockRequest = {
        cookies: { object_cookie: { nested: 'value' } },
      } as Partial<Request> as Request;

      const result = extractor(mockRequest);
      expect(result).toBeNull();
    });

    it('should return null when cookie value is not a string (array)', () => {
      const extractor = cookieExtractor('array_cookie');
      const mockRequest = {
        cookies: { array_cookie: ['value1', 'value2'] },
      } as Partial<Request> as Request;

      const result = extractor(mockRequest);
      expect(result).toBeNull();
    });

    it('should return null when cookie value is null', () => {
      const extractor = cookieExtractor('null_cookie');
      const mockRequest = {
        cookies: { null_cookie: null },
      } as Partial<Request> as Request;

      const result = extractor(mockRequest);
      expect(result).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle empty string cookie value', () => {
      const extractor = cookieExtractor('empty_cookie');
      const mockRequest = {
        cookies: { empty_cookie: '' },
      } as Partial<Request> as Request;

      const result = extractor(mockRequest);
      expect(result).toBe('');
    });

    it('should handle cookie values with whitespace', () => {
      const extractor = cookieExtractor('whitespace_cookie');
      const mockRequest = {
        cookies: { whitespace_cookie: '  token with spaces  ' },
      } as Partial<Request> as Request;

      const result = extractor(mockRequest);
      expect(result).toBe('  token with spaces  ');
    });

    it('should handle very long cookie values', () => {
      const extractor = cookieExtractor('long_cookie');
      const longValue = 'a'.repeat(4096);
      const mockRequest = {
        cookies: { long_cookie: longValue },
      } as Partial<Request> as Request;

      const result = extractor(mockRequest);
      expect(result).toBe(longValue);
    });

    it('should handle unicode characters in cookie values', () => {
      const extractor = cookieExtractor('unicode_cookie');
      const mockRequest = {
        cookies: { unicode_cookie: '你好世界🌍' },
      } as Partial<Request> as Request;

      const result = extractor(mockRequest);
      expect(result).toBe('你好世界🌍');
    });

    it('should work with empty cookie name', () => {
      const extractor = cookieExtractor('');
      const mockRequest = {
        cookies: { '': 'empty-name-value' },
      } as Partial<Request> as Request;

      const result = extractor(mockRequest);
      expect(result).toBe('empty-name-value');
    });
  });

  describe('reusability', () => {
    it('should allow reusing the same extractor function multiple times', () => {
      const extractor = cookieExtractor('reusable_cookie');

      const mockRequest1 = {
        cookies: { reusable_cookie: 'value1' },
      } as Partial<Request> as Request;

      const mockRequest2 = {
        cookies: { reusable_cookie: 'value2' },
      } as Partial<Request> as Request;

      const mockRequest3 = {
        cookies: { other: 'value3' },
      } as Partial<Request> as Request;

      expect(extractor(mockRequest1)).toBe('value1');
      expect(extractor(mockRequest2)).toBe('value2');
      expect(extractor(mockRequest3)).toBeNull();
    });

    it('should create independent extractors for different cookie names', () => {
      const extractorA = cookieExtractor('cookieA');
      const extractorB = cookieExtractor('cookieB');

      const mockRequest = {
        cookies: {
          cookieA: 'valueA',
          cookieB: 'valueB',
        },
      } as Partial<Request> as Request;

      expect(extractorA(mockRequest)).toBe('valueA');
      expect(extractorB(mockRequest)).toBe('valueB');

      // Ensure they don't interfere with each other
      expect(extractorA(mockRequest)).not.toBe('valueB');
      expect(extractorB(mockRequest)).not.toBe('valueA');
    });
  });

  describe('integration scenarios', () => {
    it('should work with real-world JWT token format', () => {
      const extractor = cookieExtractor('jwt_token');
      const jwtToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const mockRequest = {
        cookies: { jwt_token: jwtToken },
      } as Partial<Request> as Request;

      const result = extractor(mockRequest);
      expect(result).toBe(jwtToken);
    });

    it('should work with session cookie format', () => {
      const extractor = cookieExtractor('session_id');
      const sessionId = 's%3Aabcdefghijklmnopqrstuvwxyz.1234567890';
      const mockRequest = {
        cookies: { session_id: sessionId },
      } as Partial<Request> as Request;

      const result = extractor(mockRequest);
      expect(result).toBe(sessionId);
    });

    it('should handle cookies object as Record<string, unknown>', () => {
      const extractor = cookieExtractor('test_cookie');
      const mockRequest = {
        cookies: {
          test_cookie: 'test_value',
          other_cookie: 123,
          another_cookie: { nested: 'object' },
        } as Record<string, unknown>,
      } as Partial<Request> as Request;

      const result = extractor(mockRequest);
      expect(result).toBe('test_value');
    });
  });
});
