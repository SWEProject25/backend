
import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { SearchProfileDto } from './search-profile.dto';

describe('SearchProfileDto', () => {
  it('should pass validation with valid, non-empty query', async () => {
    const dto = plainToInstance(SearchProfileDto, {
      query: 'john',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail when query is empty', async () => {
    const dto = plainToInstance(SearchProfileDto, {
      query: '',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    // Should fail IsNotEmpty and possibly MinLength depending on order/implementation
    const constraints = errors[0].constraints;
    expect(constraints).toHaveProperty('isNotEmpty');
  });

  it('should fail when query is missing', async () => {
    const dto = plainToInstance(SearchProfileDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isNotEmpty');
  });
  
  it('should fail when query is not a string', async () => {
      const dto = plainToInstance(SearchProfileDto, { query: 123 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isString');
  });
});
