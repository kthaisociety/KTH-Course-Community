"use client";

import type { CourseWithUserInfo } from "@shared/types";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useUser } from "@/hooks/userHooks";
import { toggleUserFavorite } from "@/lib/user";
import { fetchCourseDetails } from "@/state/course/courseThunk";
import { executeSearch } from "@/state/search/executeSearchThunk";
import {
  filtersChanged,
  pageChanged,
  queryChanged,
} from "@/state/search/searchSlice";
import type { Dispatch, RootState } from "@/state/store";
import { toggleFavoriteSuccess } from "@/state/user/userSlice";
import SearchView from "@/views/SearchView";

export default function SearchController() {
  // Access state
  const { query, filters, results, isLoading, error } = useSelector(
    (s: RootState) => s.search,
  );
  const { userFavorites } = useUser(); // useUser hook to fetch from Redux
  const dispatch = useDispatch<Dispatch>(); // connect between redux and the component
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedCode = searchParams.get("selected");

  // Sidebar course details (Redux-backed)
  const courseDetails = useSelector((s: RootState) => s.course.courseDetails);
  const courseDetailsLoading = useSelector((s: RootState) => s.course.loading);
  const courseDetailsError = useSelector((s: RootState) => s.course.error);

  const [localQuery, setLocalQuery] = useState(
    query || "interaction programming",
  ); // redux synced
  const [resultsFull, setResultsFull] = useState<CourseWithUserInfo[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null); // useRef is used to store the timeout id

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      if (localQuery !== query) {
        dispatch(queryChanged(localQuery));
        dispatch(executeSearch());
      }
    }, 300);
    return () => {
      if (debounceRef.current) {
        // debounceRef is used to clear the timeout id
        clearTimeout(debounceRef.current); // timeout is for debouncing the search (so double clicks don't trigger multiple searches)
      }
    };
  }, [localQuery, query, dispatch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Augment search results with per-user info (favorites).
  useEffect(() => {
    setResultsFull(
      results.map((result) => ({
        ...result,
        isUserFavorite: (userFavorites ?? []).includes(result.courseCode),
      })),
    );
  }, [results, userFavorites]);

  // When ?selected= changes, pull full course details for the sidebar.
  useEffect(() => {
    if (!selectedCode) return;
    if (
      courseDetails &&
      courseDetails.courseCode.toUpperCase() === selectedCode.toUpperCase()
    ) {
      return; // already cached
    }
    dispatch(fetchCourseDetails(selectedCode));
  }, [selectedCode, courseDetails, dispatch]);

  const onSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault?.();
      dispatch(queryChanged(localQuery));
      dispatch(executeSearch());
    },
    [localQuery, dispatch], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const _onPageChange = useCallback(
    (nextPage: number) => {
      dispatch(pageChanged(nextPage));
      dispatch(executeSearch());
    },
    [dispatch], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const _onFiltersChange = useCallback(
    (next: typeof filters) => {
      dispatch(filtersChanged(next));
      dispatch(executeSearch());
    },
    [dispatch], // eslint-disable-line react-hooks/exhaustive-deps
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

  const onAddToComparison = useCallback((_courseCode: string) => {
    // TODO: add to comparison state / API
  }, []);

  async function onToggleFavorite(courseCode: string) {
    try {
      const res = await toggleUserFavorite(courseCode);

      // Update Redux
      dispatch(
        toggleFavoriteSuccess({
          courseCode,
          action: res.action,
        }),
      );

      // Update local state immediately for fast rUI updates
      setResultsFull((prev) =>
        prev.map((course) =>
          course.courseCode === courseCode
            ? { ...course, isUserFavorite: res.action === "added" }
            : course,
        ),
      );
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
      onFiltersChange={_onFiltersChange}
      onCardClick={onCardClick}
      onWriteReview={onWriteReview}
      onToggleFavorite={onToggleFavorite}
      onAddToComparison={onAddToComparison}
      selectedCode={selectedCode}
      courseDetails={courseDetails}
      courseDetailsLoading={courseDetailsLoading}
      courseDetailsError={courseDetailsError}
      onCloseDetails={onCloseDetails}
    />
  );
}
