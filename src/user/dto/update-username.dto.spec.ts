import { validate } from 'class-validator';
import { UpdateUsernameDto } from './update-username.dto';

describe('UpdateUsernameDto', () => {
  describe('valid usernames', () => {
    it('should pass with valid username', async () => {
      const dto = new UpdateUsernameDto();
      dto.username = 'john_doe';
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass with username containing dots', async () => {
      const dto = new UpdateUsernameDto();
      dto.username = 'john.doe';
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass with username containing hyphens', async () => {
      const dto = new UpdateUsernameDto();
      dto.username = 'john-doe';
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass with minimum length username (3 chars)', async () => {
      const dto = new UpdateUsernameDto();
      dto.username = 'abc';
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass with maximum length username (50 chars)', async () => {
      const dto = new UpdateUsernameDto();
      dto.username = 'a'.repeat(50);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('invalid usernames', () => {
    it('should fail with empty username', async () => {
      const dto = new UpdateUsernameDto();
      dto.username = '';
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'username')).toBe(true);
    });

    it('should fail with username less than 3 characters', async () => {
      const dto = new UpdateUsernameDto();
      dto.username = 'ab';
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'username')).toBe(true);
    });

    it('should fail with username more than 50 characters', async () => {
      const dto = new UpdateUsernameDto();
      dto.username = 'a'.repeat(51);
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'username')).toBe(true);
    });

    it('should fail with username starting with number', async () => {
      const dto = new UpdateUsernameDto();
      dto.username = '123john';
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'username')).toBe(true);
    });

    it('should fail with consecutive underscores', async () => {
      const dto = new UpdateUsernameDto();
      dto.username = 'john__doe';
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'username')).toBe(true);
    });

    it('should fail with consecutive dots', async () => {
      const dto = new UpdateUsernameDto();
      dto.username = 'john..doe';
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'username')).toBe(true);
    });

    it('should fail with consecutive hyphens', async () => {
      const dto = new UpdateUsernameDto();
      dto.username = 'john--doe';
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'username')).toBe(true);
    });

    it('should fail with special characters', async () => {
      const dto = new UpdateUsernameDto();
      dto.username = 'john@doe';
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'username')).toBe(true);
    });

    it('should fail with spaces', async () => {
      const dto = new UpdateUsernameDto();
      dto.username = 'john doe';
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'username')).toBe(true);
    });
  });
});
