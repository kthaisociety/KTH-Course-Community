import { Pool } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import type * as schema from "./schema";

export type Database = NeonDatabase<typeof schema>;

let cached: Database | undefined;

export function getDb(): Database {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  cached = drizzle({ client: new Pool({ connectionString: url }) });
  return cached;
}
