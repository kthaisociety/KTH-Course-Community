"use client";

import type { CourseWithUserInfo } from "@shared/types";
import { useQueries } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useRequireSession } from "@/hooks/sessionHooks";
import { useMe } from "@/hooks/useMe";
import { useToggleFavorite } from "@/hooks/useToggleFavorite";
import { getCourseSummary } from "@/lib/courses";
import { queryKeys } from "@/lib/query-keys";
import UserCoursesView from "@/views/UserCoursesView";

export default function UserCoursesController() {
  useRequireSession();
  const { user, isLoading: isSessionLoading } = useMe();
  const toggleFavorite = useToggleFavorite();
  const router = useRouter();
  const codes = user?.userFavorites ?? [];

  const summaryQueries = useQueries({
    queries: codes.map((courseCode) => ({
      queryKey: queryKeys.courseSummary(courseCode),
      queryFn: () => getCourseSummary(courseCode),
      enabled: !isSessionLoading,
    })),
  });

  const isLoadingFavorites =
    codes.length > 0 && summaryQueries.some((query) => query.isPending);
  const isListLoading = isSessionLoading || isLoadingFavorites;

  const userFavoriteCourses: CourseWithUserInfo[] = summaryQueries.flatMap(
    (query) => (query.data ? [{ ...query.data, isUserFavorite: true }] : []),
  );

  const onCardClick = useCallback(
    (courseCode: string) => {
      router.push(`/course/${courseCode}?from=saved`);
    },
    [router],
  );

  const onWriteReview = useCallback(
    (courseCode: string) => {
      router.push(`/course/${courseCode}?writeReview=1&from=saved`);
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
    <UserCoursesView
      userFavoriteCourses={userFavoriteCourses}
      isListLoading={isListLoading}
      onCardClick={onCardClick}
      onWriteReview={onWriteReview}
      onToggleFavorite={onToggleFavorite}
      onAddToComparison={onAddToComparison}
    />
  );
}
