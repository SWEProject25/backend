import { Injectable, OnModuleInit } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit {
  private client: RedisClientType;

  async onModuleInit() {
    this.client = createClient({
      socket: {
        host: '127.0.0.1',
        port: 6379,
      },
    });
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

  async del(key: string): Promise<number> {
    return await this.client.del(key);
  }

  getClient(): RedisClientType {
    return this.client;
  }
}
