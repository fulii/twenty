import { type Client, type Pool, type PoolClient } from 'pg';

import { QUERY_READ_TIMEOUT_MESSAGE } from 'src/engine/workspace-query-executor/constants/postgres-error-messages.constants';

type UntypedQuery = (...args: unknown[]) => unknown;

// pg-pool hands out pg.Client instances, which @types/pg narrows away
type EndablePoolClient = PoolClient & Pick<Client, 'end'>;

const isQueryReadTimeoutError = (error: unknown): boolean =>
  error instanceof Error && error.message === QUERY_READ_TIMEOUT_MESSAGE;

// pg leaves a timed-out client queryable and TypeORM releases it without an
// error, so the pool would keep reusing a socket whose peer may be gone.
// An ending client is dropped by the pool on release instead.
export const endPoolClientOnQueryReadTimeout = (pool: Pool): void => {
  const instrumentedClients = new WeakSet<PoolClient>();

  pool.on('acquire', (client) => {
    if (instrumentedClients.has(client)) {
      return;
    }

    instrumentedClients.add(client);

    const query = client.query.bind(client) as UntypedQuery;

    client.query = ((...args: unknown[]) => {
      const result = query(...args);

      if (result instanceof Promise) {
        result.catch((error: unknown) => {
          if (isQueryReadTimeoutError(error)) {
            void (client as EndablePoolClient).end();
          }
        });
      }

      return result;
    }) as PoolClient['query'];
  });
};
