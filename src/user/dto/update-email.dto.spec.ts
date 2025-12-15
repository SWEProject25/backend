import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateEmailDto } from './update-email.dto';

describe('UpdateEmailDto', () => {
  describe('valid emails', () => {
    it('should pass with valid email', async () => {
      const dto = plainToInstance(UpdateEmailDto, { email: 'test@example.com' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass with email containing subdomain', async () => {
      const dto = plainToInstance(UpdateEmailDto, { email: 'test@mail.example.com' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass with email containing plus sign', async () => {
      const dto = plainToInstance(UpdateEmailDto, { email: 'test+tag@example.com' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('invalid emails', () => {
    it('should fail with empty email', async () => {
      const dto = plainToInstance(UpdateEmailDto, { email: '' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'email')).toBe(true);
    });

    it('should fail with invalid email format', async () => {
      const dto = plainToInstance(UpdateEmailDto, { email: 'invalid-email' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'email')).toBe(true);
    });

    it('should fail with email missing domain', async () => {
      const dto = plainToInstance(UpdateEmailDto, { email: 'test@' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'email')).toBe(true);
    });

    it('should fail with email missing @', async () => {
      const dto = plainToInstance(UpdateEmailDto, { email: 'testexample.com' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'email')).toBe(true);
    });
  });

  describe('transformations', () => {
    it('should transform email to lowercase', () => {
      const dto = plainToInstance(UpdateEmailDto, { email: 'TEST@EXAMPLE.COM' });
      expect(dto.email).toBe('test@example.com');
    });

    it('should trim email whitespace', () => {
      const dto = plainToInstance(UpdateEmailDto, { email: '  test@example.com  ' });
      expect(dto.email).toBe('test@example.com');
    });

    it('should trim and lowercase together', () => {
      const dto = plainToInstance(UpdateEmailDto, { email: '  TEST@EXAMPLE.COM  ' });
      expect(dto.email).toBe('test@example.com');
    });
  });
});
