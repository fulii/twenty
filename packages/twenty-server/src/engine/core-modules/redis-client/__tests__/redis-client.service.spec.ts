import IORedis from 'ioredis';

import { RedisClientService } from 'src/engine/core-modules/redis-client/redis-client.service';
import { type TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

jest.mock('ioredis', () => jest.fn().mockImplementation(() => ({})));

const MockedIORedis = IORedis as unknown as jest.Mock;

const createService = (config: Record<string, string | undefined>) =>
  new RedisClientService({
    get: (key: string) => config[key],
  } as unknown as TwentyConfigService);

describe('RedisClientService', () => {
  beforeEach(() => {
    MockedIORedis.mockClear();
  });

  it.each([
    ['getClient', 'redis://cache:6379'],
    ['getQueueClient', 'redis://queue:6379'],
  ] as const)(
    '%s should drop sockets whose peer stopped answering',
    (method, expectedUrl) => {
      const service = createService({
        REDIS_URL: 'redis://cache:6379',
        REDIS_QUEUE_URL: 'redis://queue:6379',
      });

      service[method]();

      expect(MockedIORedis).toHaveBeenCalledWith(
        expectedUrl,
        expect.objectContaining({
          maxRetriesPerRequest: null,
          keepAlive: expect.any(Number),
          socketTimeout: expect.any(Number),
        }),
      );
    },
  );

  it('should keep the socket timeout above BullMQ blocking reads', () => {
    const service = createService({ REDIS_URL: 'redis://cache:6379' });

    service.getQueueClient();

    const [, options] = MockedIORedis.mock.calls[0];

    // BullMQ blocks for at most 10 s, plus its own 1 s grace
    expect(options.socketTimeout).toBeGreaterThan(11_000);
  });
});
