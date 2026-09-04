"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { useMe } from "@/features/auth";
import { useCourseDetails } from "@/features/courses";
import { useSetCourseSaved } from "@/features/favorites";
import type { CourseWithUserInfo } from "@/types";
import { toSearchCoursesInput, useSearchCourses } from "../api/queries";
import { useDebouncedQuery } from "./use-debounced-query";

const DEFAULT_QUERY = "interaction programming";

export function useSearchPage() {
  const { user } = useMe();
  const savedCourseCodes = user?.savedCourseCodes ?? [];
  const { toggleSaved } = useSetCourseSaved();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedCode = searchParams.get("selected");

  // The landing page hands its query over in `?q=`, so a search started there
  // arrives here as the search the visitor actually typed. Read once, as the
  // initial value: after that the field owns the query.
  const [localQuery, setLocalQuery] = useState(
    searchParams.get("q")?.trim() || DEFAULT_QUERY,
  );
  const [debouncedQuery, setDebouncedQuery] = useDebouncedQuery(localQuery);
  const [filters, setFilters] = useState<Record<string, string | string[]>>({});

  const {
    data: searchData,
    isLoading,
    error: searchError,
  } = useSearchCourses(toSearchCoursesInput(debouncedQuery, filters));

  const {
    data: courseDetails,
    isLoading: courseDetailsLoading,
    error: courseDetailsQueryError,
  } = useCourseDetails(selectedCode ?? undefined);

  const selectedCourseDetails =
    selectedCode &&
    courseDetails &&
    courseDetails.courseCode.toUpperCase() === selectedCode.toUpperCase()
      ? courseDetails
      : null;

  const results: CourseWithUserInfo[] = (
    debouncedQuery.trim() ? (searchData?.results ?? []) : []
  ).map((result) => ({
    ...result,
    isUserFavorite: savedCourseCodes.includes(result.courseCode),
  }));

  const error = searchError
    ? searchError instanceof Error
      ? searchError.message
      : "Search failed"
    : undefined;
  const courseDetailsError = courseDetailsQueryError
    ? courseDetailsQueryError instanceof Error
      ? courseDetailsQueryError.message
      : "Failed to load course"
    : null;

  const onSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault?.();
      setDebouncedQuery(localQuery);
    },
    [localQuery, setDebouncedQuery],
  );

  const onFiltersChange = useCallback(
    (next: Record<string, string | string[]>) => {
      setFilters(next);
    },
    [],
  );

  const onCardClick = useCallback(
    (courseCode: string) => {
      const next = new URLSearchParams(searchParams.toString());
      const current = next.get("selected");
      if (current && current.toUpperCase() === courseCode.toUpperCase()) {
        next.delete("selected");
      } else {
        next.set("selected", courseCode);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const onCloseDetails = useCallback(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("selected");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname, searchParams]);

  const onWriteReview = useCallback(
    (courseCode: string) => {
      router.push(`/course/${courseCode}?writeReview=1`);
    },
    [router],
  );

  const onAddToComparison = useCallback((_courseCode: string) => {}, []);

  // `toggleSaved` reads the cache at call time. Deriving the target state from
  // `savedCourseCodes` here would reuse this render's value, so two fast clicks
  // would both request the same state.
  async function onToggleFavorite(courseCode: string) {
    try {
      await toggleSaved(courseCode);
    } catch (err) {
      console.error("Failed to change saved course:", err);
    }
  }

  return {
    localQuery,
    setLocalQuery,
    onSubmit,
    isLoading,
    error,
    results,
    filters,
    onFiltersChange,
    onCardClick,
    onWriteReview,
    onToggleFavorite,
    onAddToComparison,
    selectedCode,
    courseDetails: selectedCourseDetails,
    courseDetailsLoading,
    courseDetailsError,
    onCloseDetails,
  };
}
