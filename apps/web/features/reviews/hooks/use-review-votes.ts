"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { useSessionData } from "@/features/auth";
import type { ReviewVoteType } from "@/types";
import { useVoteOnReview } from "../api/mutations";

export function useReviewVotes() {
  const { userId } = useSessionData();
  const voteMutation = useVoteOnReview();

  const vote = useCallback(
    async (reviewId: string, voteType: ReviewVoteType) => {
      if (!userId) return;
      try {
        await voteMutation.mutateAsync({ id: reviewId, voteType });
      } catch {
        toast.error("Failed to update vote", {
          description: "Try again later",
        });
      }
    },
    [voteMutation, userId],
  );

  return { vote };
}
