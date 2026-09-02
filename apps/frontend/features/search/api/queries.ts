"use client";

import { useTRPC } from "@/trpc/client";

function firstString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function toSearchCoursesInput(
  query: string,
  filters: Record<string, string | string[]>,
) {
  const department = firstString(filters.department);
  const minRatingRaw = firstString(filters.minRating);
  const minRating = minRatingRaw ? Number(minRatingRaw) : undefined;
  return {
    q: query,
    department,
    minRating: Number.isFinite(minRating) ? minRating : undefined,
  };
}

export function useSearchQueries() {
  const trpc = useTRPC();

  return {
    courses: (input: { q: string; department?: string; minRating?: number }) =>
      trpc.search.courses.queryOptions(input),
  };
}
