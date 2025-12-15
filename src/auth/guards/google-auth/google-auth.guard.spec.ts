import { ExecutionContext } from '@nestjs/common';
import { GoogleAuthGuard } from './google-auth.guard';

describe('GoogleAuthGuard', () => {
  let guard: GoogleAuthGuard;

  beforeEach(() => {
    guard = new GoogleAuthGuard();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('getAuthenticateOptions', () => {
    it('should return options with default web platform when no platform specified', () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            query: {},
          }),
        }),
      } as ExecutionContext;

      const options = guard.getAuthenticateOptions(mockContext);

      expect(options).toEqual({
        scope: ['profile', 'email'],
        state: 'web',
      });
    });

    it('should return options with custom platform from query', () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            query: { platform: 'mobile' },
          }),
        }),
      } as ExecutionContext;

      const options = guard.getAuthenticateOptions(mockContext);

      expect(options).toEqual({
        scope: ['profile', 'email'],
        state: 'mobile',
      });
    });

    it('should return options with android platform', () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            query: { platform: 'android' },
          }),
        }),
      } as ExecutionContext;

      const options = guard.getAuthenticateOptions(mockContext);

      expect(options).toEqual({
        scope: ['profile', 'email'],
        state: 'android',
      });
    });
  });
});
