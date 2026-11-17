import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

let cached: Database | undefined;

function client(): Database {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  cached = drizzle({
    client: new Pool({
      connectionString: url,
      // Idle connections must not hold the process open: without this a
      // script (`ingest`, the backfills) waits out the pool's 10 s idle
      // timeout after its work is done before it can exit.
      allowExitOnIdle: true,
    }),
  });
  return cached;
}

export const db: Database = new Proxy({} as Database, {
  get(_target, prop) {
    const instance = client();
    const value = instance[prop as keyof Database];
    return typeof value === "function" ? value.bind(instance) : value;
  },
  has(_target, prop) {
    return prop in client();
  },
});
