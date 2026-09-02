import { sql } from "drizzle-orm";
import { db } from "../db";

export async function ping() {
  await db.execute(sql`select 1`);
}
