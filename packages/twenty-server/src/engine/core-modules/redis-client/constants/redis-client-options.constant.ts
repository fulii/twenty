import { type RedisOptions } from 'ioredis';

export const REDIS_CLIENT_OPTIONS = {
  maxRetriesPerRequest: null,
  keepAlive: 10_000,
  // Drops a socket whose peer stopped answering so ioredis reconnects; kept
  // above BullMQ's 10 s maximum blocking read on the duplicated queue client.
  socketTimeout: 30_000,
} as const satisfies RedisOptions;
