import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => ({
  redisHost: process.env.REDIS_HOST || '127.0.0.1',
  redisPort: parseInt(process.env.REDIS_PORT || '6379', 10),
}));
