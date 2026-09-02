"use client";

import { useTRPC } from "@/trpc/client";

export function useReviewQueries() {
  const trpc = useTRPC();

  return {
    list: (courseCode: string) =>
      trpc.reviews.list.queryOptions({ courseCode }),
  };
}
