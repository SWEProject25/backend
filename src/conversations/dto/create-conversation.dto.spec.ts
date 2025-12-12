import { CreateConversationDto } from './create-conversation.dto';

describe('CreateConversationDto', () => {
  it('should create an instance with user IDs', () => {
    const dto = new CreateConversationDto();
    dto.user1Id = 1;
    dto.user2Id = 2;

    expect(dto.user1Id).toBe(1);
    expect(dto.user2Id).toBe(2);
  });

  it('should allow different user IDs', () => {
    const dto = new CreateConversationDto();
    dto.user1Id = 100;
    dto.user2Id = 200;

    expect(dto.user1Id).toBe(100);
    expect(dto.user2Id).toBe(200);
  });
});
