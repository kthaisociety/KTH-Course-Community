"use client";

import type { CourseWithUserInfo } from "@shared/types";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { useMe } from "@/features/auth";
import { useCourseQueries } from "@/features/courses";
import { useToggleFavorite } from "@/features/favorites";
import { toSearchCoursesInput, useSearchQueries } from "../api/queries";
import { useDebouncedQuery } from "../hooks/use-debounced-query";
import { SearchView } from "./search-view";

const DEFAULT_QUERY = "interaction programming";

export function SearchScreen() {
  const { user } = useMe();
  const userFavorites = user?.userFavorites ?? [];
  const toggleFavorite = useToggleFavorite();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedCode = searchParams.get("selected");
  const search = useSearchQueries();
  const courses = useCourseQueries();

  const [localQuery, setLocalQuery] = useState(DEFAULT_QUERY);
  const [debouncedQuery, setDebouncedQuery] = useDebouncedQuery(localQuery);
  const [filters, setFilters] = useState<Record<string, string | string[]>>({});

  const {
    data: searchData,
    isLoading,
    error: searchError,
  } = useQuery({
    ...search.courses(toSearchCoursesInput(debouncedQuery, filters)),
    enabled: Boolean(debouncedQuery.trim()),
    placeholderData: keepPreviousData,
  });

  const {
    data: courseDetails,
    isLoading: courseDetailsLoading,
    error: courseDetailsQueryError,
  } = useQuery({
    ...courses.details(selectedCode ?? ""),
    enabled: Boolean(selectedCode),
  });

  const selectedCourseDetails =
    selectedCode &&
    courseDetails &&
    courseDetails.courseCode.toUpperCase() === selectedCode.toUpperCase()
      ? courseDetails
      : null;

  const resultsFull: CourseWithUserInfo[] = (
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

  return (
    <SearchView
      localQuery={localQuery}
      setLocalQuery={setLocalQuery}
      onSubmit={onSubmit}
      isLoading={isLoading}
      error={error}
      results={resultsFull}
      filters={filters}
      onFiltersChange={onFiltersChange}
      onCardClick={onCardClick}
      onWriteReview={onWriteReview}
      onToggleFavorite={onToggleFavorite}
      onAddToComparison={onAddToComparison}
      selectedCode={selectedCode}
      courseDetails={selectedCourseDetails}
      courseDetailsLoading={courseDetailsLoading}
      courseDetailsError={courseDetailsError}
      onCloseDetails={onCloseDetails}
    />
  );
}
