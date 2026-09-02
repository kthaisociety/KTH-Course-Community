/**
 * Drizzle test double.
 *
 * The service specs in this repo mock the `DRIZZLE` token with an object whose
 * query-builder methods are chainable `jest.fn()`s. HTTP-level specs need the
 * same thing, but a request usually runs several queries in a row, so results
 * are queued instead of pinned to whichever method happens to end the chain:
 * every chain is awaitable and resolves to the next queued result, or to an
 * empty array once the queue runs dry.
 *
 * Only the chain is awaitable. The object handed to Nest as the provider value
 * is not, because Nest awaits a thenable provider and would inject whatever it
 * resolved to.
 */

const CHAIN_METHODS = [
  "select",
  "insert",
  "update",
  "delete",
  "values",
  "set",
  "from",
  "where",
  "limit",
  "offset",
  "leftJoin",
  "innerJoin",
  "orderBy",
  "groupBy",
  "onConflictDoNothing",
  "onConflictDoUpdate",
  "returning",
  "execute",
] as const;

type ChainMethod = (typeof CHAIN_METHODS)[number];

export type MockDb = { [K in ChainMethod]: jest.Mock } & {
  /** Queue the rows the next awaited query resolves to. */
  queueResult(rows: unknown): MockDb;
};

export function createMockDb(): MockDb {
  const results: unknown[] = [];
  const chain = {
    // biome-ignore lint/suspicious/noThenProperty: a Drizzle query chain is awaitable, which is exactly the behaviour being faked
    then(
      onFulfilled?: (value: unknown) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) {
      return Promise.resolve(results.length > 0 ? results.shift() : []).then(
        onFulfilled,
        onRejected,
      );
    },
  } as Record<string, unknown>;

  const db = {} as MockDb;

  for (const method of CHAIN_METHODS) {
    const mock = jest.fn(() => chain);
    chain[method] = mock;
    db[method] = mock;
  }

  db.queueResult = (rows) => {
    results.push(rows);
    return db;
  };

  return db;
}
