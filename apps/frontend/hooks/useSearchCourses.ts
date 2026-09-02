"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { searchCourses } from "@/lib/search";

export function useSearchCourses(
  query: string,
  filters: Record<string, string | string[]>,
) {
  return useQuery({
    queryKey: queryKeys.search(query, filters),
    queryFn: () => searchCourses(query, filters),
    enabled: Boolean(query.trim()),
    placeholderData: keepPreviousData,
  });
}
