import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';

describe('OptionalJwtAuthGuard', () => {
  it('should be defined', () => {
    expect(new OptionalJwtAuthGuard()).toBeDefined();
  });
});
