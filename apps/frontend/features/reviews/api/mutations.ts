"use client";

import { useTRPC } from "@/trpc/client";

export function useReviewMutations() {
  const trpc = useTRPC();

  return {
    create: () => trpc.reviews.create.mutationOptions(),
    like: () => trpc.reviews.like.mutationOptions(),
  };
}
