"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import profoundWords from "profane-words";
import { useCallback } from "react";
import { toast } from "sonner";
import type { ReviewFormData } from "@/components/review";
import { useTRPC } from "@/trpc/client";

export function useAddReview() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const createReview = useMutation(trpc.reviews.create.mutationOptions());

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
        await queryClient.invalidateQueries({
          queryKey: trpc.reviews.list.queryKey({ courseCode }),
        });
        return true;
      } catch {
        toast.error("Failed to add review", { description: "Try again later" });
        return false;
      }
    },
    [createReview, queryClient, trpc],
  );
}
