"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { type RouterOutputs, useTRPC } from "@/trpc/client";

export type SearchCourses = RouterOutputs["search"]["courses"];

/**
 * Explore's filter state, in the units the procedures take.
 *
 * `minRatingStars` is deliberately named for its scale. The dropdown asks for a
 * minimum in stars, 1-5, and `search/service.ts` converts that to the 1-10 scale
 * learning scores are stored on — so the browser sends stars and never a score.
 * Sending 8 here would mean eight stars, and zod would reject it.
 */
export type ExploreFilters = {
  department?: string;
  minRatingStars?: number;
};

/** Exactly the input `search.courses` takes, from a query and Explore's filters. */
export function toSearchCoursesInput(query: string, filters: ExploreFilters) {
  return {
    q: query,
    department: filters.department || undefined,
    minRating: filters.minRatingStars,
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
      // The previous page of results stays on screen while the next one loads,
      // so typing does not flash the whole column empty between keystrokes.
      placeholderData: keepPreviousData,
    }),
  );
}

/**
 * The schools the catalogue actually holds, for the department filter.
 *
 * These are `courses.department` as ingested, which is what the filter compares
 * against — a hardcoded list of five abbreviations would silently exclude
 * anything KOPPS names differently.
 */
export function useDepartments() {
  const trpc = useTRPC();
  return useQuery(trpc.search.departments.queryOptions());
}
