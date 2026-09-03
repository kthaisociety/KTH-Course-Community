import type { InsertFeedbackForm } from "../db/schema";
import { insertFeedback } from "./repository";

export async function submitFeedback(
  data: Omit<InsertFeedbackForm, "id" | "createdAt">,
) {
  await insertFeedback({
    id: crypto.randomUUID(),
    ...data,
  });
  return { success: true as const };
}
