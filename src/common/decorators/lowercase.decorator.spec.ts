import { plainToInstance } from 'class-transformer';
import { ToLowerCase } from './lowercase.decorator';

class TestDto {
  @ToLowerCase()
  value: any;
}

describe('ToLowerCase Decorator', () => {
  it('should convert string to lowercase', () => {
    const result = plainToInstance(TestDto, { value: 'HELLO WORLD' });
    expect(result.value).toBe('hello world');
  });

  it('should convert mixed case string to lowercase', () => {
    const result = plainToInstance(TestDto, { value: 'HeLLo WoRLd' });
    expect(result.value).toBe('hello world');
  });

  it('should keep already lowercase string unchanged', () => {
    const result = plainToInstance(TestDto, { value: 'hello world' });
    expect(result.value).toBe('hello world');
  });

  it('should pass through number unchanged', () => {
    const result = plainToInstance(TestDto, { value: 123 });
    expect(result.value).toBe(123);
  });

  it('should pass through null unchanged', () => {
    const result = plainToInstance(TestDto, { value: null });
    expect(result.value).toBeNull();
  });

  it('should pass through undefined unchanged', () => {
    const result = plainToInstance(TestDto, { value: undefined });
    expect(result.value).toBeUndefined();
  });

  it('should pass through object unchanged', () => {
    const obj = { nested: 'value' };
    const result = plainToInstance(TestDto, { value: obj });
    expect(result.value).toEqual(obj);
  });

  it('should pass through array unchanged', () => {
    const arr = ['A', 'B', 'C'];
    const result = plainToInstance(TestDto, { value: arr });
    expect(result.value).toEqual(arr);
  });

  it('should handle empty string', () => {
    const result = plainToInstance(TestDto, { value: '' });
    expect(result.value).toBe('');
  });

  it('should handle string with special characters', () => {
    const result = plainToInstance(TestDto, { value: 'TEST@EMAIL.COM' });
    expect(result.value).toBe('test@email.com');
  });
});
