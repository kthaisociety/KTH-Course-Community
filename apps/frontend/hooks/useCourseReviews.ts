"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

export function useCourseReviews(courseCode: string | null | undefined) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.reviews.list.queryOptions({ courseCode: courseCode ?? "" }),
    enabled: Boolean(courseCode),
  });
}
