"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { type RouterOutputs, useTRPC } from "@/trpc/client";

export type SearchCourses = RouterOutputs["search"]["courses"];

/**
 * Explore's filter state, in the units the procedures take.
 *
 * School is the only filter. A minimum-rating threshold used to live here too;
 * it was in no artboard and has been removed — see `server/search/service.ts`
 * for what went and why. An old `?rating=` link is simply not read any more, so
 * it lands on unfiltered results rather than on an error.
 */
export type ExploreFilters = {
  department?: string;
};

/** Exactly the input `search.courses` takes, from a query and Explore's filters. */
export function toSearchCoursesInput(query: string, filters: ExploreFilters) {
  return {
    q: query,
    department: filters.department || undefined,
  };
}

export function useSearchCourses(input: { q: string; department?: string }) {
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
