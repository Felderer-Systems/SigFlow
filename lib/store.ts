// Copyright (c) 2026 Felderer Systems. Licensed under MIT.
import type { Redis } from 'ioredis';
import RedisClient from 'ioredis';
import { getRuntimeConfig } from '@/lib/runtime-config';

interface KeyValueStore {
  get(key: string): Promise<string | null>;
  setEx(key: string, ttlSeconds: number, value: string): Promise<void>;
  del(key: string): Promise<void>;
  incr(key: string, ttlSeconds: number): Promise<number>;
}

class InMemoryStore implements KeyValueStore {
  private readonly map = new Map<string, { value: string; expiresAt: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.map.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() >= entry.expiresAt) {
      this.map.delete(key);
      return null;
    }

    return entry.value;
  }

  async setEx(key: string, ttlSeconds: number, value: string): Promise<void> {
    this.map.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async del(key: string): Promise<void> {
    this.map.delete(key);
  }

  async incr(key: string, ttlSeconds: number): Promise<number> {
    const now = Date.now();
    const entry = this.map.get(key);

    if (!entry || now >= entry.expiresAt) {
      this.map.set(key, { value: '1', expiresAt: now + ttlSeconds * 1000 });
      return 1;
    }

    const next = Number.parseInt(entry.value, 10) + 1;
    this.map.set(key, { value: String(next), expiresAt: entry.expiresAt });
    return next;
  }
}

class RedisStore implements KeyValueStore {
  constructor(private readonly redis: Redis) {}

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async setEx(key: string, ttlSeconds: number, value: string): Promise<void> {
    await this.redis.set(key, value, 'EX', ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async incr(key: string, ttlSeconds: number): Promise<number> {
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, ttlSeconds);
    }
    return count;
  }
}

let redisSingleton: Redis | null = null;
let storeSingleton: KeyValueStore | null = null;

function getRedis(): Redis {
  if (redisSingleton) {
    return redisSingleton;
  }

  const config = getRuntimeConfig();
  if (!config.REDIS_URL) {
    throw new Error('REDIS_URL is required when in-memory fallback is disabled.');
  }

  redisSingleton = new RedisClient(config.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    enableAutoPipelining: true,
  });

  return redisSingleton;
}

export function getStore(): KeyValueStore {
  if (storeSingleton) {
    return storeSingleton;
  }

  const config = getRuntimeConfig();

  if (config.REDIS_URL) {
    storeSingleton = new RedisStore(getRedis());
    return storeSingleton;
  }

  if (config.ALLOW_INMEMORY_FALLBACK) {
    storeSingleton = new InMemoryStore();
    return storeSingleton;
  }

  throw new Error(
    'REDIS_URL is not set. Configure Redis for production-grade OTP/session storage.',
  );
}

export function prefixedKey(suffix: string): string {
  const config = getRuntimeConfig();
  return `${config.REDIS_PREFIX}:${suffix}`;
}
