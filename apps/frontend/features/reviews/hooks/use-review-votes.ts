"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { useSessionData } from "@/features/auth";
import { useLikeReview } from "../api/mutations";

export function useReviewVotes(courseCode: string) {
  const { userId } = useSessionData();
  const likeMutation = useLikeReview(courseCode);

  const like = useCallback(
    async (postId: string) => {
      if (!userId) return;
      try {
        await likeMutation.mutateAsync({ id: postId });
      } catch {
        toast.error("Failed to update vote", {
          description: "Try again later",
        });
      }
    },
    [likeMutation, userId],
  );

  const dislike = useCallback(
    async (postId: string) => {
      if (!userId) return;
      void postId;
      toast.info("Dislike is temporarily unavailable");
    },
    [userId],
  );

  return { like, dislike };
}
