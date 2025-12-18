import { MarkSeenDto } from './mark-seen.dto';

describe('MarkSeenDto', () => {
  it('should create an instance with all properties', () => {
    const dto = new MarkSeenDto();
    dto.conversationId = 1;
    dto.userId = 2;

    expect(dto.conversationId).toBe(1);
    expect(dto.userId).toBe(2);
  });
});
