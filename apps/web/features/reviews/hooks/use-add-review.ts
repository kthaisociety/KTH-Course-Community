"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { useCreateReview } from "../api/mutations";
import type { ReviewFormData } from "../components/review";
import { warnAboutProfanity } from "../lib/profanity";
import { toStoredMessage } from "../lib/review-text";

export function useAddReview() {
  const createReview = useCreateReview();

  return useCallback(
    async (
      courseCode: string,
      reviewForm: ReviewFormData,
    ): Promise<boolean> => {
      if (warnAboutProfanity(reviewForm.message)) return false;
      try {
        await createReview.mutateAsync({
          courseCode,
          ...reviewForm,
          message: toStoredMessage(reviewForm.message),
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
