import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { PaginationDto } from './pagination.dto';

describe('PaginationDto', () => {
  describe('default values', () => {
    it('should have default page of 1', () => {
      const dto = new PaginationDto();
      expect(dto.page).toBe(1);
    });

    it('should have default limit of 10', () => {
      const dto = new PaginationDto();
      expect(dto.limit).toBe(10);
    });
  });

  describe('valid values', () => {
    it('should pass with valid page and limit', async () => {
      const dto = plainToInstance(PaginationDto, { page: 5, limit: 20 });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass with minimum page value of 1', async () => {
      const dto = plainToInstance(PaginationDto, { page: 1, limit: 10 });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass with maximum page value of 10000', async () => {
      const dto = plainToInstance(PaginationDto, { page: 10000, limit: 10 });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass with minimum limit value of 1', async () => {
      const dto = plainToInstance(PaginationDto, { page: 1, limit: 1 });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass with maximum limit value of 100', async () => {
      const dto = plainToInstance(PaginationDto, { page: 1, limit: 100 });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('invalid values', () => {
    it('should fail with page less than 1', async () => {
      const dto = plainToInstance(PaginationDto, { page: 0, limit: 10 });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'page')).toBe(true);
    });

    it('should fail with page greater than 10000', async () => {
      const dto = plainToInstance(PaginationDto, { page: 10001, limit: 10 });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'page')).toBe(true);
    });

    it('should fail with limit less than 1', async () => {
      const dto = plainToInstance(PaginationDto, { page: 1, limit: 0 });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'limit')).toBe(true);
    });

    it('should fail with limit greater than 100', async () => {
      const dto = plainToInstance(PaginationDto, { page: 1, limit: 101 });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'limit')).toBe(true);
    });

    it('should fail with non-integer page', async () => {
      const dto = plainToInstance(PaginationDto, { page: 1.5, limit: 10 });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'page')).toBe(true);
    });

    it('should fail with non-integer limit', async () => {
      const dto = plainToInstance(PaginationDto, { page: 1, limit: 10.5 });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'limit')).toBe(true);
    });
  });

  describe('type transformation', () => {
    it('should transform string page to number', () => {
      const dto = plainToInstance(PaginationDto, { page: '5', limit: '20' });
      expect(typeof dto.page).toBe('number');
      expect(dto.page).toBe(5);
    });

    it('should transform string limit to number', () => {
      const dto = plainToInstance(PaginationDto, { page: '1', limit: '50' });
      expect(typeof dto.limit).toBe('number');
      expect(dto.limit).toBe(50);
    });
  });
});
