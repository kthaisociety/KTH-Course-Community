import { z } from "zod";
import {
  examinationDistributionSchema,
  percentSchema,
  reviewScoreSchema,
} from "@/types";
import { toPlainText } from "./review-text";

/**
 * What every review is checked against on its way to the database. It shares
 * the wire contract from `@/types` and adds only what is specific to a review
 * written in a form: a message that is not just markup.
 *
 * Three surfaces draw a review form — the dialog, the workspace pane's draft,
 * and the fast-track card stack — and this is the single validator all three
 * meet, because `useAddReview` and `useEditReview` run it themselves rather
 * than trusting each form to have run it. A form may ask for *more* than this
 * (the dialog does, with `requireMessage`); none of them can send less.
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
