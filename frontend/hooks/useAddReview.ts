"use client";

import profoundWords from "profane-words";
import { useCallback } from "react";
import { useDispatch } from "react-redux";
import { toast } from "sonner";
import type { ReviewFormData } from "@/components/review";
import { fetchCourseReviews, submitReview } from "@/state/reviews/reviewThunk";
import type { Dispatch } from "@/state/store";

export function useAddReview() {
  const dispatch = useDispatch<Dispatch>();

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
          description: `Disapproved words: ${profoundMatches.join(", ")}`,
          submitReview({ courseCode, userId, reviewForm }),
        ).unwrap();
        toast.success("Review added successfully!");
        dispatch(fetchCourseReviews({ courseCode, userId }));
        return true;
      } catch {
        toast.error("Failed to add review", { description: "Try again later" });
        return false;
      }
    },
    [dispatch],
  );
}
