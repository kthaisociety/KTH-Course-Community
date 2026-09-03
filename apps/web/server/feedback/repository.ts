import { db } from "../db";
import { feedback_form, type InsertFeedbackForm } from "../db/schema";

export async function insertFeedback(
  data: Omit<InsertFeedbackForm, "id" | "createdAt"> & { id: string },
) {
  await db.insert(feedback_form).values(data);
}
