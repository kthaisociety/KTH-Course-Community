"use client";

import type { CourseWithUserInfo } from "@shared/types";
import { useQueries } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useMe, useRequireSession } from "@/features/auth";
import { useCourseQueries } from "@/features/courses";
import { useToggleFavorite } from "../api/mutations";
import { FavoritesView } from "./favorites-view";

export function FavoritesScreen() {
  useRequireSession();
  const courses = useCourseQueries();
  const { user, isLoading: isSessionLoading } = useMe();
  const toggleFavorite = useToggleFavorite();
  const router = useRouter();
  const codes = user?.userFavorites ?? [];

  const summaryQueries = useQueries({
    queries: codes.map((courseCode) => ({
      ...courses.summary(courseCode),
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
      await toggleFavorite.mutateAsync({ courseCode });
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
    }
  }

  return (
    <FavoritesView
      userFavoriteCourses={userFavoriteCourses}
      isListLoading={isListLoading}
      onCardClick={onCardClick}
      onWriteReview={onWriteReview}
      onToggleFavorite={onToggleFavorite}
      onAddToComparison={onAddToComparison}
    />
  );
}
