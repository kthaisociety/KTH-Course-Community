import type { Database } from "./db";
import { feedback_form, type InsertFeedbackForm } from "./db/schema";

export async function submitFeedback(
  db: Database,
  data: Omit<InsertFeedbackForm, "id" | "createdAt">,
) {
  await db.insert(feedback_form).values({
    id: crypto.randomUUID(),
    ...data,
  });
  return { success: true as const };
}
