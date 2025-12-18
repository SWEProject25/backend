import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateUserDto } from './update-user.dto';

describe('UpdateUserDto', () => {
  describe('all fields optional', () => {
    it('should pass with empty object', async () => {
      const dto = plainToInstance(UpdateUserDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('email validation', () => {
    it('should pass with valid email', async () => {
      const dto = plainToInstance(UpdateUserDto, { email: 'test@example.com' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with invalid email', async () => {
      const dto = plainToInstance(UpdateUserDto, { email: 'invalid' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'email')).toBe(true);
    });

    it('should transform email to lowercase', () => {
      const dto = plainToInstance(UpdateUserDto, { email: 'TEST@EXAMPLE.COM' });
      expect(dto.email).toBe('test@example.com');
    });

    it('should trim email', () => {
      const dto = plainToInstance(UpdateUserDto, { email: '  test@example.com  ' });
      expect(dto.email).toBe('test@example.com');
    });
  });

  describe('username validation', () => {
    it('should pass with valid username', async () => {
      const dto = plainToInstance(UpdateUserDto, { username: 'john_doe123' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with username less than 3 characters', async () => {
      const dto = plainToInstance(UpdateUserDto, { username: 'ab' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'username')).toBe(true);
    });

    it('should fail with username more than 50 characters', async () => {
      const dto = plainToInstance(UpdateUserDto, { username: 'a'.repeat(51) });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'username')).toBe(true);
    });

    it('should fail with username starting with number', async () => {
      const dto = plainToInstance(UpdateUserDto, { username: '123john' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'username')).toBe(true);
    });

    it('should fail with consecutive special characters', async () => {
      const dto = plainToInstance(UpdateUserDto, { username: 'john__doe' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'username')).toBe(true);
    });

    it('should transform username to lowercase', () => {
      const dto = plainToInstance(UpdateUserDto, { username: 'JohnDoe' });
      expect(dto.username).toBe('johndoe');
    });
  });

  describe('name validation', () => {
    it('should pass with valid name', async () => {
      const dto = plainToInstance(UpdateUserDto, { name: 'John Doe' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with name containing numbers', async () => {
      const dto = plainToInstance(UpdateUserDto, { name: 'John123' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'name')).toBe(true);
    });
  });

  describe('URL validations', () => {
    it('should pass with valid profileImageUrl', async () => {
      const dto = plainToInstance(UpdateUserDto, { profileImageUrl: 'https://example.com/image.jpg' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with invalid profileImageUrl', async () => {
      const dto = plainToInstance(UpdateUserDto, { profileImageUrl: 'not-a-url' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'profileImageUrl')).toBe(true);
    });

    it('should pass with valid bannerImageUrl', async () => {
      const dto = plainToInstance(UpdateUserDto, { bannerImageUrl: 'https://example.com/banner.jpg' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with invalid bannerImageUrl', async () => {
      const dto = plainToInstance(UpdateUserDto, { bannerImageUrl: 'invalid' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'bannerImageUrl')).toBe(true);
    });

    it('should pass with valid website', async () => {
      const dto = plainToInstance(UpdateUserDto, { website: 'https://mywebsite.com' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with invalid website', async () => {
      const dto = plainToInstance(UpdateUserDto, { website: 'not-a-website' });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'website')).toBe(true);
    });
  });

  describe('bio validation', () => {
    it('should pass with valid bio', async () => {
      const dto = plainToInstance(UpdateUserDto, { bio: 'Hello, I am a developer!' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with bio more than 160 characters', async () => {
      const dto = plainToInstance(UpdateUserDto, { bio: 'a'.repeat(161) });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'bio')).toBe(true);
    });

    it('should trim bio', () => {
      const dto = plainToInstance(UpdateUserDto, { bio: '  Hello world  ' });
      expect(dto.bio).toBe('Hello world');
    });
  });

  describe('location validation', () => {
    it('should pass with valid location', async () => {
      const dto = plainToInstance(UpdateUserDto, { location: 'Cairo, Egypt' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with location more than 100 characters', async () => {
      const dto = plainToInstance(UpdateUserDto, { location: 'a'.repeat(101) });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'location')).toBe(true);
    });
  });

  describe('birthDate validation', () => {
    it('should pass with valid birthDate', async () => {
      const today = new Date();
      const dto = plainToInstance(UpdateUserDto, {
        birthDate: new Date(today.getFullYear() - 20, 0, 1),
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with age below 15', async () => {
      const today = new Date();
      const dto = plainToInstance(UpdateUserDto, {
        birthDate: new Date(today.getFullYear() - 10, 0, 1),
      });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'birthDate')).toBe(true);
    });
  });
});
