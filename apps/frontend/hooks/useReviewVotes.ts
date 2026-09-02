"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";
import { useMe } from "@/hooks/useMe";
import { queryKeys } from "@/lib/query-keys";
import { likeReview } from "@/lib/reviews";

export function useReviewVotes(courseCode: string) {
  const queryClient = useQueryClient();
  const { userId } = useMe();

  const like = useCallback(
    async (postId: string) => {
      if (!userId) return;
      try {
        await likeReview(postId, userId);
        await queryClient.invalidateQueries({
          queryKey: queryKeys.reviews(courseCode),
        });
      } catch {
        toast.error("Failed to update vote", {
          description: "Try again later",
        });
      }
    },
    [queryClient, userId, courseCode],
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
