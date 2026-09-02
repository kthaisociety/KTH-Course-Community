"use client";

import type { CourseWithUserInfo } from "@shared/types";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { useMe } from "@/features/auth";
import { useCourseDetails } from "@/features/courses";
import { useToggleFavorite } from "@/features/favorites";
import { toSearchCoursesInput, useSearchCourses } from "../api/queries";
import { useDebouncedQuery } from "./use-debounced-query";

const DEFAULT_QUERY = "interaction programming";

export function useSearchPage() {
  const { user } = useMe();
  const userFavorites = user?.userFavorites ?? [];
  const toggleFavorite = useToggleFavorite();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedCode = searchParams.get("selected");

  const [localQuery, setLocalQuery] = useState(DEFAULT_QUERY);
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
    isUserFavorite: userFavorites.includes(result.courseCode),
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

  async function onToggleFavorite(courseCode: string) {
    try {
      await toggleFavorite.mutateAsync({ courseCode });
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
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
