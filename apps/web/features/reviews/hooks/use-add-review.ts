"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { useCreateReview } from "../api/mutations";
import type { ReviewFormData } from "../components/review";
import { warnAboutProfanity } from "../lib/profanity";
import { reviewFormSchema } from "../lib/review-form-schema";
import { toStoredMessage } from "../lib/review-text";

/**
 * Every review this app publishes goes through here.
 *
 * Three surfaces write a review — the review dialog, the workspace pane's
 * review draft, and the fast-track card stack on `/taken` — and they draw
 * completely different forms. That is fine, and deliberate: a card stack asking
 * one course at a time is a better shape for a queue than a modal is. What is
 * not fine is three ideas of what a valid review looks like, so the check lives
 * here, on the write path, rather than in each form.
 *
 * `requireMessage: false` because prose is a rule about a *form*, not about a
 * review: `reviews.message` is nullable and a scores-only review is a valid
 * row. The dialog still asks for prose before it gets here, with its own
 * `reviewFormSchema({ requireMessage: true })`; the card stack and the pane
 * make the write-up optional, as their artboards do. What this guarantees is
 * the part that is not negotiable — 1–10 scores, a `happyTook`, a distribution
 * that either adds to 100 or is absent, and a theory percent in range — so no
 * presentation can send something the server would have to refuse.
 */
export function useAddReview() {
  const createReview = useCreateReview();

  return useCallback(
    async (
      courseCode: string,
      reviewForm: ReviewFormData,
    ): Promise<boolean> => {
      if (warnAboutProfanity(reviewForm.message)) return false;

      const checked = reviewFormSchema({ requireMessage: false }).safeParse(
        reviewForm,
      );
      if (!checked.success) {
        toast.error("That review is not finished", {
          description: checked.error.issues[0]?.message ?? "Check your answers",
        });
        return false;
      }

      try {
        await createReview.mutateAsync({
          courseCode,
          ...checked.data,
          message: toStoredMessage(checked.data.message),
        });
        toast.success("Review added successfully!");
        return true;
      } catch {
        toast.error("Failed to add review", { description: "Try again later" });
        return false;
      }
    },
    [createReview],
  );
}
