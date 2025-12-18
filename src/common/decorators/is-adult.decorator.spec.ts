import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { IsAdult } from './is-adult.decorator';

class TestDto {
  @IsAdult()
  birthDate: Date;
}

describe('IsAdult Decorator', () => {
  const createDto = (birthDate: any) => {
    const dto = new TestDto();
    dto.birthDate = birthDate;
    return dto;
  };

  describe('valid ages', () => {
    it('should pass for 15 year old', async () => {
      const today = new Date();
      const birthDate = new Date(today.getFullYear() - 15, today.getMonth(), today.getDate());
      const dto = createDto(birthDate);

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass for 50 year old', async () => {
      const today = new Date();
      const birthDate = new Date(today.getFullYear() - 50, today.getMonth(), today.getDate());
      const dto = createDto(birthDate);

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass for 100 year old', async () => {
      const today = new Date();
      const birthDate = new Date(today.getFullYear() - 100, today.getMonth(), today.getDate());
      const dto = createDto(birthDate);

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('invalid ages', () => {
    it('should fail for 14 year old', async () => {
      const today = new Date();
      const birthDate = new Date(today.getFullYear() - 14, today.getMonth(), today.getDate());
      const dto = createDto(birthDate);

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail for 101 year old', async () => {
      const today = new Date();
      const birthDate = new Date(today.getFullYear() - 101, today.getMonth(), today.getDate());
      const dto = createDto(birthDate);

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail for future date', async () => {
      const today = new Date();
      const birthDate = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
      const dto = createDto(birthDate);

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should fail for null value', async () => {
      const dto = createDto(null);

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail for undefined value', async () => {
      const dto = createDto(undefined);

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail for invalid date string', async () => {
      const dto = createDto(new Date('invalid-date'));

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should handle birthday not yet occurred this year', async () => {
      const today = new Date();
      // Set birth date to be 15 years ago but birthday hasn't occurred yet this year
      const birthDate = new Date(today.getFullYear() - 15, today.getMonth() + 1, today.getDate());
      const dto = createDto(birthDate);

      const errors = await validate(dto);
      // Should fail because they haven't turned 15 yet
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should handle birthday already occurred this year', async () => {
      const today = new Date();
      // Set birth date to be 15 years ago and birthday has occurred
      const birthDate = new Date(today.getFullYear() - 15, today.getMonth() - 1, today.getDate());
      const dto = createDto(birthDate);

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });
});
