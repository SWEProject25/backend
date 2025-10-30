import { Transform } from 'class-transformer';

/**
 * Trim strings
 */
export const Trim = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
