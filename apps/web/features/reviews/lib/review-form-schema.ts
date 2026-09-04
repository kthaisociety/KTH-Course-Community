import { z } from "zod";
import {
  examinationDistributionSchema,
  percentSchema,
  reviewScoreSchema,
} from "@/types";
import { toPlainText } from "./review-text";

/**
 * What the review dialog validates before it submits. It shares the wire
 * contract from `@/types` and adds only what is specific to writing a review in
 * a dialog: a message that is not just markup.
 *
 * `requireMessage` is the one thing that differs between writing and editing.
 * Asking for prose is a rule about *publishing* something new — there is no
 * point in a blank first review. It cannot be a rule about the stored row:
 * `reviews.message` is nullable, and a scores-only review is a valid thing to
 * hold. Applying it on edit would trap an author inside their own scores-only
 * review, unable to correct a workload score without inventing prose to go
 * with it.
 */
export function reviewFormSchema({
  requireMessage,
}: {
  requireMessage: boolean;
}) {
  const message = requireMessage
    ? z
        .string()
        .refine((html) => toPlainText(html).length > 0, "Write a review.")
    : z.string();

  return z.object({
    happyTook: z.boolean(),
    message,
    examinationDistribution: examinationDistributionSchema.nullable(),
    approachTheoryPercent: percentSchema.nullable(),
    workloadScore: reviewScoreSchema,
    learningScore: reviewScoreSchema,
  });
}
