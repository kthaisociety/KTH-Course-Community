"use client";

import { useQuery } from "@tanstack/react-query";
import { type RouterOutputs, useTRPC } from "@/trpc/client";

export type ReviewList = RouterOutputs["reviews"]["list"];

export function useReviewList(courseCode: string | undefined) {
  const trpc = useTRPC();
  return useQuery(
    trpc.reviews.list.queryOptions(
      { courseCode: courseCode ?? "" },
      { enabled: Boolean(courseCode) },
    ),
  );
}
