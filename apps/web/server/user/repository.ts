import { eq } from "drizzle-orm";
import { db } from "../db";
import * as schema from "../db/schema";

export async function deleteById(id: string) {
  await db.delete(schema.users).where(eq(schema.users.id, id));
}
