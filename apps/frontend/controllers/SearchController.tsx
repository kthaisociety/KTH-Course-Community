"use client";

import type { CourseWithUserInfo } from "@shared/types";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCourseDetails } from "@/hooks/useCourseDetails";
import { useMe } from "@/hooks/useMe";
import { useSearchCourses } from "@/hooks/useSearchCourses";
import { useToggleFavorite } from "@/hooks/useToggleFavorite";
import SearchView from "@/views/SearchView";

const DEFAULT_QUERY = "interaction programming";

export default function SearchController() {
  const { user } = useMe();
  const userFavorites = user?.userFavorites ?? [];
  const toggleFavorite = useToggleFavorite();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedCode = searchParams.get("selected");

  const [localQuery, setLocalQuery] = useState(DEFAULT_QUERY);
  const [debouncedQuery, setDebouncedQuery] = useState(DEFAULT_QUERY);
  const [filters, setFilters] = useState<Record<string, string | string[]>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(localQuery);
    }, 300);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [localQuery]);

  const {
    data: searchData,
    isLoading,
    error: searchError,
  } = useSearchCourses(debouncedQuery, filters);

  const {
    data: courseDetails,
    isLoading: courseDetailsLoading,
    error: courseDetailsQueryError,
  } = useCourseDetails(selectedCode);

  const selectedCourseDetails =
    selectedCode &&
    courseDetails &&
    courseDetails.courseCode.toUpperCase() === selectedCode.toUpperCase()
      ? courseDetails
      : null;

  const resultsFull: CourseWithUserInfo[] = (searchData?.results ?? []).map(
    (result) => ({
      ...result,
      isUserFavorite: userFavorites.includes(result.courseCode),
    }),
  );

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
    [localQuery],
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
      await toggleFavorite.mutateAsync(courseCode);
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
