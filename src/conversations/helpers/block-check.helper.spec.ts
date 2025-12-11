import { getBlockCheckWhere } from './block-check.helper';

describe('getBlockCheckWhere', () => {
  it('should return correct where clause for checking blocks between users', () => {
    const result = getBlockCheckWhere(1, 2);

    expect(result).toEqual({
      OR: [
        { blockerId: 1, blockedId: 2 },
        { blockerId: 2, blockedId: 1 },
      ],
    });
  });

  it('should handle same numbers (edge case)', () => {
    const result = getBlockCheckWhere(5, 5);

    expect(result).toEqual({
      OR: [
        { blockerId: 5, blockedId: 5 },
        { blockerId: 5, blockedId: 5 },
      ],
    });
  });

  it('should work with large user IDs', () => {
    const result = getBlockCheckWhere(999999, 1000000);

    expect(result).toEqual({
      OR: [
        { blockerId: 999999, blockedId: 1000000 },
        { blockerId: 1000000, blockedId: 999999 },
      ],
    });
  });
});
