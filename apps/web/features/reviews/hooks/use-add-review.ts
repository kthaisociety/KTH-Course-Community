"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { useCreateReview } from "../api/mutations";
import type { ReviewFormData } from "../components/review";
import { findProfanity } from "../lib/profanity";

export function useAddReview() {
  const createReview = useCreateReview();

  return useCallback(
    async (
      courseCode: string,
      reviewForm: ReviewFormData,
    ): Promise<boolean> => {
      const profoundMatches = findProfanity(reviewForm.message);
      if (profoundMatches.length > 0) {
        toast("Please refrain from using profane language", {
          description: `Dissaproved words: ${profoundMatches.join(", ")}`,
        });
        return false;
      }
      try {
        await createReview.mutateAsync({ courseCode, ...reviewForm });
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
