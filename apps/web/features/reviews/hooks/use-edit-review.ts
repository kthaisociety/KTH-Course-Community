"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { useUpdateReview } from "../api/mutations";
import type { ReviewFormData } from "../components/review";
import { findProfanity } from "../lib/profanity";

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
      const profoundMatches = findProfanity(reviewForm.message);
      if (profoundMatches.length > 0) {
        toast("Please refrain from using profane language", {
          description: `Dissaproved words: ${profoundMatches.join(", ")}`,
        });
        return false;
      }
      try {
        await updateReview.mutateAsync({ id, ...reviewForm });
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
