"use client";

import { useQueryClient } from "@tanstack/react-query";
import profoundWords from "profane-words";
import { useCallback } from "react";
import { toast } from "sonner";
import type { ReviewFormData } from "@/components/review";
import { queryKeys } from "@/lib/query-keys";
import { createReview } from "@/lib/reviews";

export function useAddReview() {
  const queryClient = useQueryClient();

  return useCallback(
    async (
      courseCode: string,
      userId: string,
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
        await createReview(courseCode, userId, reviewForm);
        toast.success("Review added successfully!");
        await queryClient.invalidateQueries({
          queryKey: queryKeys.reviews(courseCode),
        });
        return true;
      } catch {
        toast.error("Failed to add review", { description: "Try again later" });
        return false;
      }
    },
    [queryClient],
  );
}
