import { RemoveMessageDto } from './remove-message.dto';

describe('RemoveMessageDto', () => {
  it('should create an instance with all properties', () => {
    const dto = new RemoveMessageDto();
    dto.userId = 1;
    dto.conversationId = 2;
    dto.messageId = 3;

    expect(dto.userId).toBe(1);
    expect(dto.conversationId).toBe(2);
    expect(dto.messageId).toBe(3);
  });

  it('should allow different values', () => {
    const dto = new RemoveMessageDto();
    dto.userId = 100;
    dto.conversationId = 200;
    dto.messageId = 300;

    expect(dto.userId).toBe(100);
    expect(dto.conversationId).toBe(200);
    expect(dto.messageId).toBe(300);
  });
});
