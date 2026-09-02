"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

function firstString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function useSearchCourses(
  query: string,
  filters: Record<string, string | string[]>,
) {
  const trpc = useTRPC();
  const department = firstString(filters.department);
  const minRatingRaw = firstString(filters.minRating);
  const minRating = minRatingRaw ? Number(minRatingRaw) : undefined;

  return useQuery({
    ...trpc.search.courses.queryOptions({
      q: query,
      department,
      minRating: Number.isFinite(minRating) ? minRating : undefined,
    }),
    enabled: Boolean(query.trim()),
    placeholderData: keepPreviousData,
  });
}
