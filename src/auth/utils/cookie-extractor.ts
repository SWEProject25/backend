import { Request } from 'express';

export function cookieExtractor(
  cookieName: string,
): (req: Request) => string | null {
  return (req?: Request): string | null => {
    const cookies = req?.cookies as Record<string, unknown> | undefined;
    const token = cookies?.[cookieName];
    return typeof token === 'string' ? token : null;
  };
}
