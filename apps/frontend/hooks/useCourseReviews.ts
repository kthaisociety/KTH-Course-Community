"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { findAllReviews } from "@/lib/reviews";

export function useCourseReviews(
  courseCode: string | null | undefined,
  userId?: string,
) {
  return useQuery({
    queryKey: [...queryKeys.reviews(courseCode ?? ""), userId ?? ""] as const,
    queryFn: () => findAllReviews(courseCode as string, userId),
    enabled: Boolean(courseCode),
  });
}
