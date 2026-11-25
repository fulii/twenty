import { EventEmitter } from 'events';

import { Pool, type PoolClient, type PoolConfig } from 'pg';

import { endPoolClientOnQueryReadTimeout } from 'src/database/typeorm/utils/end-pool-client-on-query-read-timeout.util';

const SLOW_QUERY = 'SELECT pg_sleep(60)';
const FAILING_QUERY = 'SELECT * FROM missing_table';

// Stands in for pg.Client so the real pg-pool decides which clients it reuses
class FakeClient extends EventEmitter {
  _queryable = true;
  _ending = false;
  endCount = 0;

  connect(callback: (error: Error | null) => void) {
    process.nextTick(() => callback(null));
  }

  query(text: string) {
    if (text === SLOW_QUERY) {
      return Promise.reject(new Error('Query read timeout'));
    }

    if (text === FAILING_QUERY) {
      return Promise.reject(
        new Error('relation "missing_table" does not exist'),
      );
    }

    return Promise.resolve({ rows: [{ text }] });
  }

  end() {
    this._ending = true;
    this.endCount++;

    return Promise.resolve();
  }
}

const createPool = () => {
  const pool = new Pool({
    max: 1,
    Client: FakeClient,
  } as unknown as PoolConfig);

  endPoolClientOnQueryReadTimeout(pool);

  return pool;
};

const runAndRelease = async (pool: Pool, text: string) => {
  const client = await pool.connect();

  try {
    return await client.query(text);
  } finally {
    client.release();
  }
};

describe('endPoolClientOnQueryReadTimeout', () => {
  let pool: Pool;

  beforeEach(() => {
    jest.useRealTimers();
    pool = createPool();
  });

  afterEach(async () => {
    await pool.end();
  });

  it('should hand out a fresh connection after a query read timeout', async () => {
    const firstClient = await pool.connect();

    await expect(firstClient.query(SLOW_QUERY)).rejects.toThrow(
      'Query read timeout',
    );
    firstClient.release();

    const secondClient = await pool.connect();

    expect(secondClient).not.toBe(firstClient);
    expect((firstClient as unknown as FakeClient).endCount).toBeGreaterThan(0);
    expect(pool.totalCount).toBe(1);

    secondClient.release();
  });

  it('should keep reusing the connection after other query errors', async () => {
    const firstClient = await pool.connect();

    await expect(firstClient.query(FAILING_QUERY)).rejects.toThrow(
      'does not exist',
    );
    firstClient.release();

    const secondClient: PoolClient = await pool.connect();

    expect(secondClient).toBe(firstClient);
    expect((firstClient as unknown as FakeClient).endCount).toBe(0);

    secondClient.release();
  });

  it('should return query results unchanged', async () => {
    await expect(runAndRelease(pool, 'SELECT 1')).resolves.toEqual({
      rows: [{ text: 'SELECT 1' }],
    });
    await expect(runAndRelease(pool, 'SELECT 2')).resolves.toEqual({
      rows: [{ text: 'SELECT 2' }],
    });
  });
});
