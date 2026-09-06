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

/**
 * Exactly the input `search.courses` takes, from a query, Explore's filters and
 * the page it is on.
 *
 * Page 1 sends no `page` at all rather than `page: 1`. The two mean the same
 * thing to the server, but react-query hashes a key by its contents, so
 * omitting it keeps the first page under the same key as a caller that does not
 * page at all — which is what lets Taken courses reuse `useSearchCourses`
 * without paying for a second copy of every first-page search.
 */
export function toSearchCoursesInput(
  query: string,
  filters: ExploreFilters,
  page = 1,
) {
  return {
    q: query,
    department: filters.department || undefined,
    page: page > 1 ? page : undefined,
  };
}

export function useSearchCourses(input: {
  q: string;
  department?: string;
  page?: number;
}) {
  const trpc = useTRPC();
  return useQuery(
    trpc.search.courses.queryOptions(input, {
      enabled: Boolean(input.q.trim()),
      // The previous page of results stays on screen while the next one loads,
      // so typing does not flash the whole column empty between keystrokes —
      // and neither does paging. `isPlaceholderData` is how a caller tells the
      // two apart, which matters for `page`: the reply carries the page the
      // server actually served, and while this flag is set that reply is the
      // *previous* page's.
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
