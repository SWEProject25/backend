import { CreateMessageDto } from './create-message.dto';

describe('CreateMessageDto', () => {
  it('should create an instance with all properties', () => {
    const dto = new CreateMessageDto();
    dto.conversationId = 1;
    dto.senderId = 2;
    dto.text = 'Hello world!';

    expect(dto.conversationId).toBe(1);
    expect(dto.senderId).toBe(2);
    expect(dto.text).toBe('Hello world!');
  });
});
