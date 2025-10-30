import { Transform } from 'class-transformer';

/**
 * Convert string to lowercase
 */
export const ToLowerCase = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase() : value));
