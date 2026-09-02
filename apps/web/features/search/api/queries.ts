"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { type RouterOutputs, useTRPC } from "@/trpc/client";

export type SearchCourses = RouterOutputs["search"]["courses"];

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

export function useSearchCourses(input: {
  q: string;
  department?: string;
  minRating?: number;
}) {
  const trpc = useTRPC();
  return useQuery(
    trpc.search.courses.queryOptions(input, {
      enabled: Boolean(input.q.trim()),
      placeholderData: keepPreviousData,
    }),
  );
}
