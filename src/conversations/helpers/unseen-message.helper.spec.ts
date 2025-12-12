import { getUnseenMessageCountWhere } from './unseen-message.helper';

describe('getUnseenMessageCountWhere', () => {
  it('should return correct where clause for unseen messages', () => {
    const result = getUnseenMessageCountWhere(1, 5);

    expect(result).toEqual({
      conversationId: 1,
      isSeen: false,
      senderId: {
        not: 5,
      },
    });
  });

  it('should work with different conversation and user IDs', () => {
    const result = getUnseenMessageCountWhere(100, 200);

    expect(result).toEqual({
      conversationId: 100,
      isSeen: false,
      senderId: {
        not: 200,
      },
    });
  });

  it('should work with large IDs', () => {
    const result = getUnseenMessageCountWhere(999999, 888888);

    expect(result).toEqual({
      conversationId: 999999,
      isSeen: false,
      senderId: {
        not: 888888,
      },
    });
  });
});
