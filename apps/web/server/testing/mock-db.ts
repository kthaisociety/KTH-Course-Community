import { vi } from "vitest";

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

export type MockDb = { [K in ChainMethod]: ReturnType<typeof vi.fn> } & {
  queueResult(rows: unknown): MockDb;
};

export function createMockDb(): MockDb {
  const results: unknown[] = [];
  const chain = {
    // biome-ignore lint/suspicious/noThenProperty: Drizzle query chains are awaitable
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
    const mock = vi.fn(() => chain);
    chain[method] = mock;
    db[method] = mock;
  }

  db.queueResult = (rows) => {
    results.push(rows);
    return db;
  };

  return db;
}
