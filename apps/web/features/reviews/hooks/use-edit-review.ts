"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { useUpdateReview } from "../api/mutations";
import type { ReviewFormData } from "../components/review";
import { warnAboutProfanity } from "../lib/profanity";
import { toStoredMessage } from "../lib/review-text";

/**
 * Rewrites a review the viewer already published. The same draft check as
 * writing one, so a message that could not be posted cannot be edited in
 * either. Authorship is the server's call: `reviews.update` refuses anyone but
 * the author no matter which id is sent.
 */
export function useEditReview(courseCode: string) {
  const updateReview = useUpdateReview(courseCode);

  return useCallback(
    async (id: string, reviewForm: ReviewFormData): Promise<boolean> => {
      if (warnAboutProfanity(reviewForm.message)) return false;
      try {
        await updateReview.mutateAsync({
          id,
          ...reviewForm,
          message: toStoredMessage(reviewForm.message),
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
