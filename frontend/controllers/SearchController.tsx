"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useUser } from "@/hooks/userHooks";
import { getCourseCredits } from "@/lib/courses";
import { toggleUserFavorite } from "@/lib/user";
import { executeSearch } from "@/state/search/executeSearchThunk";
import {
  filtersChanged,
  pageChanged,
  queryChanged,
} from "@/state/search/searchSlice";
import type { Dispatch, RootState } from "@/state/store";
import { toggleFavoriteSuccess } from "@/state/user/userSlice";
import SearchView from "@/views/SearchView";
import type { CourseWithUserInfo } from "../models/CourseModel";

export default function SearchController() {
  // Access state
  const { query, filters, results, isLoading, error } = useSelector(
    (s: RootState) => s.search,
  );
  const { userFavorites } = useUser(); // useUser hook to fetch from Redux
  const dispatch = useDispatch<Dispatch>(); // connect between redux and the component
  const router = useRouter();
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

  // Adds 'isUserFavorites' and 'credits' to the result course object
  useEffect(() => {
    const fetchResultsWithUserInfo = async () => {
      const resultsWithFavorites = results.map((result) => ({
        ...result,
        isUserFavorite: (userFavorites ?? []).includes(result.courseCode),
      }));

      // Fetch credits for each course
      const resultsWithCredits = await Promise.all(
        resultsWithFavorites.map(async (result) => {
          try {
            const credits = await getCourseCredits(result.courseCode);
            return {
              ...result,
              credits: credits,
            };
          } catch (error) {
            console.error(
              `Failed to fetch credits for ${result.courseCode}:`,
              error,
            );
            return result;
          }
        }),
      );

      setResultsFull(resultsWithCredits);
    };

    fetchResultsWithUserInfo();
  }, [results, userFavorites]);

  // Are the "useCallbacks" really necessary here for the callback functions?

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
  // onSortChange

  const onSeeReviews = useCallback(
    (courseCode: string) => {
      router.push(`/course/${courseCode}`);
    },
    [router],
  );

  const onWriteReview = useCallback(
    (courseCode: string) => {
      router.push(`/course/${courseCode}`);
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
      onSeeReviews={onSeeReviews}
      onWriteReview={onWriteReview}
      onToggleFavorite={onToggleFavorite}
      onAddToComparison={onAddToComparison}
    />
  );
}
