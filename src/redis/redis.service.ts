import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';
import redisConfig from 'src/config/redis.config';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: RedisClientType;
  private subscriber: RedisClientType;
  private publisher: RedisClientType;

  constructor(
    @Inject(redisConfig.KEY)
    private readonly redisConfiguration: ConfigType<typeof redisConfig>,
  ) {}
  async onModuleInit() {
    const config = {
      socket: {
        host: this.redisConfiguration.redisHost,
        port: this.redisConfiguration.redisPort,
      },
    };

    // Main client for general operations
    this.client = createClient(config);
    this.client.on('error', (err) => console.error('Redis Client Error:', err));
    this.client.on('connect', () => console.log('Redis connected'));
    this.client.on('ready', () => console.log('Redis ready'));
    await this.client.connect();

    // Dedicated subscriber client
    this.subscriber = createClient(config);
    this.subscriber.on('error', (err) => console.error('Redis Subscriber Error:', err));
    await this.subscriber.connect();

    // Dedicated publisher client
    this.publisher = createClient(config);
    this.publisher.on('error', (err) => console.error('Redis Publisher Error:', err));
    await this.publisher.connect();
  }

  async onModuleDestroy() {
    await this.client?.quit();
    await this.subscriber?.quit();
    await this.publisher?.quit();
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

  // Set operations for connection tracking
  async sAdd(key: string, ...members: string[]): Promise<number> {
    return await this.client.sAdd(key, members);
  }

  async sRem(key: string, ...members: string[]): Promise<number> {
    return await this.client.sRem(key, members);
  }

  async sMembers(key: string): Promise<string[]> {
    return await this.client.sMembers(key);
  }

  async sCard(key: string): Promise<number> {
    return await this.client.sCard(key);
  }

  async sIsMember(key: string, member: string): Promise<boolean> {
    const result = await this.client.sIsMember(key, member);
    return result === 1;
  }

  // Pub/Sub operations
  async publish(channel: string, message: string): Promise<number> {
    return await this.publisher.publish(channel, message);
  }

  async subscribe(
    channel: string,
    callback: (message: string, channel: string) => void,
  ): Promise<void> {
    await this.subscriber.subscribe(channel, callback);
  }

  async unsubscribe(channel: string): Promise<void> {
    await this.subscriber.unsubscribe(channel);
  }

  // Hash operations for storing user socket data
  async hSet(key: string, field: string, value: string): Promise<number> {
    return await this.client.hSet(key, field, value);
  }

  async hGet(key: string, field: string): Promise<string | null> {
    return await this.client.hGet(key, field);
  }

  async hGetAll(key: string): Promise<Record<string, string>> {
    return await this.client.hGetAll(key);
  }

  async hDel(key: string, ...fields: string[]): Promise<number> {
    return await this.client.hDel(key, fields);
  }
}
