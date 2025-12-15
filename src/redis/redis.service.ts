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

  async getJSON<T>(key: string): Promise<T | null> {
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  async setJSON(key: string, value: any, ttl?: number): Promise<void> {
    const data = JSON.stringify(value);
    if (ttl) {
      await this.client.setEx(key, ttl, data);
    } else {
      await this.client.set(key, data);
    }
  }

  async delPattern(pattern: string): Promise<number> {
    const keys = await this.client.keys(pattern);
    if (keys.length === 0) return 0;
    return await this.client.del(keys);
  }

  // Sorted Set operations for trending hashtags
  async zAdd(key: string, members: Array<{ score: number; value: string }>): Promise<number> {
    return await this.client.zAdd(key, members);
  }

  async zRangeWithScores(
    key: string,
    start: number,
    stop: number,
    options?: { REV?: boolean },
  ): Promise<Array<{ value: string; score: number }>> {
    console.log('zrange service method');
    const result = await this.client.zRangeWithScores(key, start, stop, options);
    console.log(result);
    return result;
  }

  async zCount(key: string, min: number | string, max: number | string): Promise<number> {
    return await this.client.zCount(key, min, max);
  }

  async zRem(key: string, members: string | string[]): Promise<number> {
    return await this.client.zRem(key, members);
  }

  async zRemRangeByRank(key: string, start: number, stop: number): Promise<number> {
    return await this.client.zRemRangeByRank(key, start, stop);
  }

  async zRemRangeByScore(key: string, min: number | string, max: number | string): Promise<number> {
    return await this.client.zRemRangeByScore(key, min, max);
  }

  async zCard(key: string): Promise<number> {
    return await this.client.zCard(key);
  }

  async zScore(key: string, member: string): Promise<number | null> {
    return await this.client.zScore(key, member);
  }

  async zIncrBy(key: string, increment: number, member: string): Promise<number> {
    return await this.client.zIncrBy(key, increment, member);
  }

  async zRange(
    key: string,
    start: number,
    stop: number,
    options?: { REV?: boolean },
  ): Promise<string[]> {
    return await this.client.zRange(key, start, stop, options);
  }

  async zRangeByScore(key: string, min: number | string, max: number | string): Promise<string[]> {
    return await this.client.zRangeByScore(key, min, max);
  }

  async incr(key: string): Promise<number> {
    return await this.client.incr(key);
  }

  async zRangeByScoreWithScores(
    key: string,
    min: number | string,
    max: number | string,
  ): Promise<Array<{ value: string; score: number }>> {
    return await this.client.zRangeByScoreWithScores(key, min, max);
  }

  getClient(): RedisClientType {
    return this.client;
  }
}
