import { ExecutionContext } from '@nestjs/common';
import { GithubAuthGuard } from './github-auth.guard';

describe('GithubAuthGuard', () => {
  let guard: GithubAuthGuard;

  beforeEach(() => {
    guard = new GithubAuthGuard();
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
        scope: ['user:email'],
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
        scope: ['user:email'],
        state: 'mobile',
      });
    });

    it('should return options with ios platform', () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            query: { platform: 'ios' },
          }),
        }),
      } as ExecutionContext;

      const options = guard.getAuthenticateOptions(mockContext);

      expect(options).toEqual({
        scope: ['user:email'],
        state: 'ios',
      });
    });
  });
});
