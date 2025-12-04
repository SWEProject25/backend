import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';
import redisConfig from 'src/config/redis.config';

@Injectable()
export class RedisService implements OnModuleInit {
  private client: RedisClientType;

  constructor(
    @Inject(redisConfig.KEY)
    private readonly redisConfiguration: ConfigType<typeof redisConfig>,
  ) {}
  async onModuleInit() {
    this.client = createClient({
      socket: {
        host: this.redisConfiguration.redisHost,
        port: this.redisConfiguration.redisPort,
      },
    });
    this.client.on('error', (err) => console.error('Redis Client Error:', err));
    this.client.on('connect', () => console.log('Redis connected'));
    this.client.on('ready', () => console.log('Redis ready'));
    await this.client.connect();
  }

  async keys(pattern: string = '*'): Promise<string[]> {
    return await this.client.keys(pattern);
  }

  async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.client.setEx(key, ttl, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async ttl(key: string): Promise<number> {
    return await this.client.ttl(key);
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    const result = await this.client.expire(key, seconds);
    return result === 1;
  }

  async del(key: string): Promise<number> {
    return await this.client.del(key);
  }

  getClient(): RedisClientType {
    return this.client;
  }
}
