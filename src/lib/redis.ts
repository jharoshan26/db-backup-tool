import IORedis, { Redis } from 'ioredis';
import { config } from '@/config';

// BullMQ requires maxRetriesPerRequest = null on its connection.
export function createRedis(): Redis {
  return new IORedis(config.redis.url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

// Shared connection for app-level pub/sub and generic use.
export const redis = createRedis();
