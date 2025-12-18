import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateUserDto } from './create-user.dto';

describe('CreateUserDto', () => {
  const createValidDto = () => {
    const today = new Date();
    return {
      name: 'John Doe',
      email: 'test@example.com',
      password: 'Password123!',
      birthDate: new Date(today.getFullYear() - 20, 0, 1),
    };
  };

  describe('valid data', () => {
    it('should pass with all valid fields', async () => {
      const dto = plainToInstance(CreateUserDto, createValidDto());
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass without optional birthDate', async () => {
      const data = createValidDto();
      delete (data as any).birthDate;
      const dto = plainToInstance(CreateUserDto, data);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('name validation', () => {
    it('should fail with name less than 3 characters', async () => {
      const dto = plainToInstance(CreateUserDto, { ...createValidDto(), name: 'Jo' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'name')).toBe(true);
    });

    it('should fail with name more than 50 characters', async () => {
      const dto = plainToInstance(CreateUserDto, { ...createValidDto(), name: 'a'.repeat(51) });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'name')).toBe(true);
    });

    it('should fail with name containing numbers', async () => {
      const dto = plainToInstance(CreateUserDto, { ...createValidDto(), name: 'John123' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'name')).toBe(true);
    });

    it('should pass with accented characters', async () => {
      const dto = plainToInstance(CreateUserDto, { ...createValidDto(), name: 'José García' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass with hyphenated name', async () => {
      const dto = plainToInstance(CreateUserDto, { ...createValidDto(), name: 'Mary-Jane' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass with apostrophe in name', async () => {
      const dto = plainToInstance(CreateUserDto, { ...createValidDto(), name: "O'Connor" });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('email validation', () => {
    it('should fail with invalid email format', async () => {
      const dto = plainToInstance(CreateUserDto, { ...createValidDto(), email: 'invalid-email' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'email')).toBe(true);
    });

    it('should fail with empty email', async () => {
      const dto = plainToInstance(CreateUserDto, { ...createValidDto(), email: '' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'email')).toBe(true);
    });

    it('should transform email to lowercase', () => {
      const dto = plainToInstance(CreateUserDto, { ...createValidDto(), email: 'TEST@EXAMPLE.COM' });
      expect(dto.email).toBe('test@example.com');
    });

    it('should trim email whitespace', () => {
      const dto = plainToInstance(CreateUserDto, { ...createValidDto(), email: '  test@example.com  ' });
      expect(dto.email).toBe('test@example.com');
    });
  });

  describe('password validation', () => {
    it('should fail with password less than 8 characters', async () => {
      const dto = plainToInstance(CreateUserDto, { ...createValidDto(), password: 'Pass1!' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'password')).toBe(true);
    });

    it('should fail with password more than 50 characters', async () => {
      const dto = plainToInstance(CreateUserDto, { ...createValidDto(), password: 'Password1!' + 'a'.repeat(41) });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'password')).toBe(true);
    });

    it('should fail with password without uppercase', async () => {
      const dto = plainToInstance(CreateUserDto, { ...createValidDto(), password: 'password123!' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'password')).toBe(true);
    });

    it('should fail with password without lowercase', async () => {
      const dto = plainToInstance(CreateUserDto, { ...createValidDto(), password: 'PASSWORD123!' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'password')).toBe(true);
    });

    it('should fail with password without number', async () => {
      const dto = plainToInstance(CreateUserDto, { ...createValidDto(), password: 'Password!' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'password')).toBe(true);
    });

    it('should fail with password without special character', async () => {
      const dto = plainToInstance(CreateUserDto, { ...createValidDto(), password: 'Password123' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'password')).toBe(true);
    });
  });

  describe('birthDate validation', () => {
    it('should fail with age below 15', async () => {
      const today = new Date();
      const dto = plainToInstance(CreateUserDto, {
        ...createValidDto(),
        birthDate: new Date(today.getFullYear() - 14, today.getMonth(), today.getDate()),
      });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'birthDate')).toBe(true);
    });

    it('should fail with age above 100', async () => {
      const today = new Date();
      const dto = plainToInstance(CreateUserDto, {
        ...createValidDto(),
        birthDate: new Date(today.getFullYear() - 101, 0, 1),
      });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'birthDate')).toBe(true);
    });

    it('should pass with age of 15', async () => {
      const today = new Date();
      const dto = plainToInstance(CreateUserDto, {
        ...createValidDto(),
        birthDate: new Date(today.getFullYear() - 15, today.getMonth() - 1, today.getDate()),
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });
});
