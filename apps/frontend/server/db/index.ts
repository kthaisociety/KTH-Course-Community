import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import type * as schema from "./schema";

export type Database = NeonHttpDatabase<typeof schema>;

let cached: Database | undefined;

export function getDb(): Database {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  cached = drizzle({ client: neon(url) });
  return cached;
}
