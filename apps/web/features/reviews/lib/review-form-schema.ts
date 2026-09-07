import { z } from "zod";
import type { ExaminationDistribution } from "@/types";
import {
  examinationDistributionSchema,
  percentSchema,
  reviewScoreSchema,
} from "@/types";
import { toPlainText } from "./review-text";

/**
 * A finished review as a form hands it over: every answer given, the write-up
 * as the markup `reviews.message` holds, and nothing about which surface asked.
 *
 * It is the boundary between the two review forms and the one write path.
 * `answersToReviewFormData` and `toReviewFormData` are the only two mappers
 * that produce it, and `useAddReview` and `useEditReview` are the only two
 * things that consume it — both of which re-check it against the schema below
 * rather than trusting the form that built it.
 *
 * The two nullable fields are the stored answer for "I don't remember". They
 * are never zeroes; see `CONTEXT.md`.
 */
export type ReviewFormData = {
  happyTook: boolean;
  message: string;
  examinationDistribution: ExaminationDistribution | null;
  approachTheoryPercent: number | null;
  workloadScore: number;
  learningScore: number;
};

/**
 * What every review is checked against on its way to the database. It shares
 * the wire contract from `@/types` and adds only what is specific to a review
 * written in a form: a message that is not just markup.
 *
 * Two surfaces draw a review form — the full review editor, wherever it is
 * hosted, and the fast-track card stack — and this is the single validator both
 * meet, because `useAddReview` and `useEditReview` run it themselves rather
 * than trusting each form to have run it. A form may ask for *more* than this;
 * neither can send less.
 *
 * `requireMessage` is the one thing that differs between writing and editing.
 * Asking for prose is a rule about *publishing* something new — there is no
 * point in a blank first review. It cannot be a rule about the stored row:
 * `reviews.message` is nullable, and a scores-only review is a valid thing to
 * hold. Applying it on edit would trap an author inside their own scores-only
 * review, unable to correct a workload score without inventing prose to go
 * with it.
 *
 * Nothing asks for it today: the two surfaces that publish a review both make
 * the write-up optional, as their artboards do. The option stays because the
 * distinction is about publishing rather than about the row, and a surface that
 * wants prose before a first review should say so here rather than invent its
 * own check.
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
