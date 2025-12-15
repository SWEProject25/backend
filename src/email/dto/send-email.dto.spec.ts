import { validate } from 'class-validator';
import { SendEmailDto } from './send-email.dto';

describe('SendEmailDto', () => {
  it('should validate with string array recipients', async () => {
    const dto = new SendEmailDto();
    dto.recipients = ['test@example.com', 'test2@example.com'];
    dto.subject = 'Test Subject';
    dto.html = '<p>Test content</p>';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should validate with single email recipient', async () => {
    const dto = new SendEmailDto();
    dto.recipients = ['test@example.com'];
    dto.subject = 'Test Subject';
    dto.html = '<p>Test content</p>';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should validate with optional text field', async () => {
    const dto = new SendEmailDto();
    dto.recipients = ['test@example.com'];
    dto.subject = 'Test Subject';
    dto.html = '<p>Test content</p>';
    dto.text = 'Plain text content';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail validation with invalid email in array', async () => {
    const dto = new SendEmailDto();
    dto.recipients = ['invalid-email'];
    dto.subject = 'Test Subject';
    dto.html = '<p>Test content</p>';

    const errors = await validate(dto);
    expect(errors.some(e => e.property === 'recipients')).toBe(true);
  });

  it('should fail validation with empty html', async () => {
    const dto = new SendEmailDto();
    dto.recipients = ['test@example.com'];
    dto.subject = 'Test Subject';
    dto.html = '';

    const errors = await validate(dto);
    expect(errors.some(e => e.property === 'html')).toBe(true);
  });

  it('should fail validation with missing subject', async () => {
    const dto = new SendEmailDto();
    dto.recipients = ['test@example.com'];
    dto.subject = undefined as any;
    dto.html = '<p>Test content</p>';

    const errors = await validate(dto);
    expect(errors.some(e => e.property === 'subject')).toBe(true);
  });

  it('should validate without optional text field', async () => {
    const dto = new SendEmailDto();
    dto.recipients = ['test@example.com'];
    dto.subject = 'Test Subject';
    dto.html = '<p>Test content</p>';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.text).toBeUndefined();
  });
});
