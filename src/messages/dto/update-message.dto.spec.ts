import { UpdateMessageDto } from './update-message.dto';

describe('UpdateMessageDto', () => {
  it('should create an instance with all properties', () => {
    const dto = new UpdateMessageDto();
    dto.id = 1;
    dto.senderId = 2;
    dto.text = 'Updated message';

    expect(dto.id).toBe(1);
    expect(dto.senderId).toBe(2);
    expect(dto.text).toBe('Updated message');
  });
});
