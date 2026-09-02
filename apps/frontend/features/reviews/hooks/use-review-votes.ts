"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";
import { useSessionData } from "@/features/auth";
import { useTRPC } from "@/trpc/client";
import { useReviewMutations } from "../api/mutations";

export function useReviewVotes(courseCode: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { userId } = useSessionData();
  const reviews = useReviewMutations();
  const likeMutation = useMutation(reviews.like());

  const like = useCallback(
    async (postId: string) => {
      if (!userId) return;
      try {
        await likeMutation.mutateAsync({ id: postId });
        await queryClient.invalidateQueries({
          queryKey: trpc.reviews.list.queryKey({ courseCode }),
        });
      } catch {
        toast.error("Failed to update vote", {
          description: "Try again later",
        });
      }
    },
    [likeMutation, queryClient, trpc, userId, courseCode],
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
