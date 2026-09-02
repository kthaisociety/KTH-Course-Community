import { Pool } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import type * as schema from "./schema";

export type Database = NeonDatabase<typeof schema>;

let cached: Database | undefined;

function client(): Database {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  cached = drizzle({ client: new Pool({ connectionString: url }) });
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
