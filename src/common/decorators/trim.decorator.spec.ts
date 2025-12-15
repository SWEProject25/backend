import { plainToInstance } from 'class-transformer';
import { Trim } from './trim.decorator';

class TestDto {
  @Trim()
  value: any;
}

describe('Trim Decorator', () => {
  it('should trim whitespace from beginning and end', () => {
    const result = plainToInstance(TestDto, { value: '  hello world  ' });
    expect(result.value).toBe('hello world');
  });

  it('should trim leading whitespace', () => {
    const result = plainToInstance(TestDto, { value: '   hello' });
    expect(result.value).toBe('hello');
  });

  it('should trim trailing whitespace', () => {
    const result = plainToInstance(TestDto, { value: 'hello   ' });
    expect(result.value).toBe('hello');
  });

  it('should keep string without whitespace unchanged', () => {
    const result = plainToInstance(TestDto, { value: 'hello' });
    expect(result.value).toBe('hello');
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

  it('should handle string with only whitespace', () => {
    const result = plainToInstance(TestDto, { value: '   ' });
    expect(result.value).toBe('');
  });

  it('should trim tabs and newlines', () => {
    const result = plainToInstance(TestDto, { value: '\t\nhello world\n\t' });
    expect(result.value).toBe('hello world');
  });
});
