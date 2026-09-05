"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { useUpdateReview } from "../api/mutations";
import type { ReviewFormData } from "../components/review";
import { warnAboutProfanity } from "../lib/profanity";
import { reviewFormSchema } from "../lib/review-form-schema";
import { toStoredMessage } from "../lib/review-text";

/**
 * Rewrites a review the viewer already published. The same draft check and the
 * same `reviewFormSchema` as writing one, so a review that could not be posted
 * cannot be edited into existence either. Authorship is the server's call:
 * `reviews.update` refuses anyone but the author no matter which id is sent.
 */
export function useEditReview() {
  const updateReview = useUpdateReview();

  return useCallback(
    async (id: string, reviewForm: ReviewFormData): Promise<boolean> => {
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
        await updateReview.mutateAsync({
          id,
          ...checked.data,
          message: toStoredMessage(checked.data.message),
        });
        toast.success("Review updated");
        return true;
      } catch {
        toast.error("Failed to update review", {
          description: "Try again later",
        });
        return false;
      }
    },
    [updateReview],
  );
}
