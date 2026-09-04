"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { AuthReason } from "@/features/auth";
import { NO_COURSE_STATS, useCourseStats } from "@/features/courses";
import type { CourseStats, CourseSummary } from "@/types";
import {
  type ExploreFilters,
  toSearchCoursesInput,
  useDepartments,
  useSearchCourses,
} from "../api/queries";
import { useDebouncedQuery } from "./use-debounced-query";

/** The lowest and highest thresholds the rating dropdown offers, in stars. */
export const MIN_RATING_STARS = 1;
export const MAX_RATING_STARS = 5;

/**
 * A star threshold as the URL can carry it, or `null` for "any rating".
 *
 * The URL is typed by hand as often as it is clicked, and `search.courses`
 * rejects anything outside 1-5, so an unusable value is dropped here rather than
 * turned into a failed request the reader cannot explain.
 */
function readStars(raw: string | null): number | null {
  const stars = Number(raw);
  return Number.isInteger(stars) &&
    stars >= MIN_RATING_STARS &&
    stars <= MAX_RATING_STARS
    ? stars
    : null;
}

/**
 * Everything Explore renders, and everything a click on it does.
 *
 * ## The query lives in two places on purpose
 *
 * `?q=` seeds the field once, so a link shared out of Explore — or handed over
 * by the landing page's hero — opens on the search it names rather than empty
 * (#95). After that the field owns what is typed, because a text input driven
 * from the URL cannot keep up with a keystroke, and the debounced value is
 * mirrored *back* into `?q=` so the address bar always names the results on
 * screen. `router.replace` rather than `push`: a search that grew a character at
 * a time must not leave twelve entries in the reader's history.
 *
 * The filters are the other way round — the URL drives them, because each is one
 * discrete click with nothing to keep up with, and that makes Back undo a filter.
 */
export function useExplore() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [authReason, setAuthReason] = useState<AuthReason | null>(null);

  const [field, setField] = useState(() => searchParams.get("q")?.trim() ?? "");
  const [debouncedField, setDebouncedField] = useDebouncedQuery(field);
  const query = debouncedField.trim();

  const department = searchParams.get("department") ?? "";
  const minRatingStars = readStars(searchParams.get("rating"));

  const setParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      const queryString = next.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
        scroll: false,
      });
    },
    [router, pathname, searchParams],
  );

  // Mirror only, and only when it would change something: `setParams` is rebuilt
  // whenever the params change, so an unguarded write here would replace the URL
  // with itself on every navigation.
  useEffect(() => {
    if ((searchParams.get("q") ?? "") === query) return;
    setParams({ q: query || null });
  }, [query, searchParams, setParams]);

  const filters: ExploreFilters = {
    department: department || undefined,
    minRatingStars: minRatingStars ?? undefined,
  };

  const search = useSearchCourses(toSearchCoursesInput(query, filters));
  const departments = useDepartments();

  const results: CourseSummary[] = query ? (search.data?.results ?? []) : [];

  // A fresh array every render, which costs nothing: react-query hashes a query
  // key by its contents, so the same codes are the same query.
  const stats = useCourseStats(results.map((course) => course.courseCode));
  const statsByCode: Record<string, CourseStats> = stats.data ?? {};

  const onQueryChange = useCallback((value: string) => setField(value), []);

  /** Enter, or the magnifier: skip the debounce and search what is typed now. */
  const onSubmit = useCallback(
    (event?: React.FormEvent) => {
      event?.preventDefault?.();
      setDebouncedField(field);
    },
    [field, setDebouncedField],
  );

  const onClearQuery = useCallback(() => {
    setField("");
    setDebouncedField("");
  }, [setDebouncedField]);

  /** A suggestion from the empty state runs immediately; nothing is half-typed. */
  const onSuggestQuery = useCallback(
    (value: string) => {
      setField(value);
      setDebouncedField(value);
    },
    [setDebouncedField],
  );

  const onDepartmentChange = useCallback(
    (value: string) => setParams({ department: value || null }),
    [setParams],
  );

  const onMinRatingChange = useCallback(
    (stars: number | null) =>
      setParams({ rating: stars ? String(stars) : null }),
    [setParams],
  );

  const onClearFilters = useCallback(
    () => setParams({ department: null, rating: null }),
    [setParams],
  );

  const onOpenCourse = useCallback(
    (courseCode: string) => router.push(`/course/${courseCode}`),
    [router],
  );

  const onReviewCourse = useCallback(
    (courseCode: string) => router.push(`/course/${courseCode}?writeReview=1`),
    [router],
  );

  return {
    field,
    onQueryChange,
    onSubmit,
    onClearQuery,
    onSuggestQuery,

    query,
    hasQuery: query.length > 0,
    results,
    statsFor: (courseCode: string) =>
      statsByCode[courseCode] ?? NO_COURSE_STATS,
    // `isFetching`, not `isLoading`: `keepPreviousData` keeps the last results
    // mounted while the next request runs, and the column has to say so.
    isLoading: search.isFetching,
    isError: search.isError,
    onRetry: () => void search.refetch(),

    department,
    minRatingStars,
    departments: departments.data?.departments ?? [],
    onDepartmentChange,
    onMinRatingChange,
    onClearFilters,
    hasFilters: Boolean(department) || minRatingStars !== null,

    authReason,
    setAuthReason,
    onOpenCourse,
    onReviewCourse,
  };
}
