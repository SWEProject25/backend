import { registerAs } from '@nestjs/config';
import { JwtModuleOptions } from '@nestjs/jwt';

export default registerAs(
  'jwt',
  (): JwtModuleOptions => ({
    secret: process.env.JWT_SECRET!,
    signOptions: {
      expiresIn: parseInt(process.env.JWT_EXPIRES_IN!, 10),
    },
  }),
);
