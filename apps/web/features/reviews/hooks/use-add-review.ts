"use client";

import profoundWords from "profane-words";
import { useCallback } from "react";
import { toast } from "sonner";
import { useCreateReview } from "../api/mutations";
import type { ReviewFormData } from "../components/review";

export function useAddReview() {
  const createReview = useCreateReview();

  return useCallback(
    async (
      courseCode: string,
      _userId: string,
      reviewForm: ReviewFormData,
    ): Promise<boolean> => {
      const plainText = reviewForm.content.replace(/<[^>]*>/g, " ");
      const escapeRegex = (s: string) =>
        s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const profoundMatches = profoundWords
        .filter(Boolean)
        .filter((badWord) =>
          new RegExp(`\\b${escapeRegex(String(badWord))}\\b`, "i").test(
            plainText,
          ),
        );
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
