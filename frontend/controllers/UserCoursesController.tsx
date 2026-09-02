"use client";

import type { CourseWithUserInfo } from "@shared/types";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useRequireSession } from "@/hooks/sessionHooks";
import { useFavorites } from "@/hooks/userHooks";
import { getCourseSummary } from "@/lib/courses";
import UserCoursesView from "@/views/UserCoursesView";

export default function UserCoursesController() {
  // Redirects to /auth if the session resolves to null. `useFavorites`
  // reads the session too, but only to decide whether to fetch; nothing
  // here sends the user away when it is missing.
  useRequireSession();
  const {
    favorites,
    isLoading: isFavoritesLoading,
    toggle: toggleFavorite,
  } = useFavorites();
  const [userFavoriteCourses, setUserFavoriteCourses] = useState<
    CourseWithUserInfo[]
  >([]);
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(true);

  const router = useRouter();

  const isListLoading = isFavoritesLoading || isLoadingFavorites;

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

  const onAddToComparison = useCallback((_courseCode: string) => {
    // TODO: comparison state / API (same as search)
  }, []);

  async function onToggleFavorite(courseCode: string) {
    try {
      const res = await toggleFavorite(courseCode);

      if (res.action === "added") {
        const course = await getCourseSummary(courseCode);
        setUserFavoriteCourses((prev) => {
          if (prev.some((c) => c.courseCode === courseCode)) {
            return [...prev];
          }
          return [...prev, { ...course, isUserFavorite: true }];
        });
      } else if (res.action === "removed") {
        setUserFavoriteCourses((prev) =>
          prev.filter((course) => course.courseCode !== courseCode),
        );
      }
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
    }
  }

  useEffect(() => {
    if (isFavoritesLoading) return;

    let cancelled = false;

    async function fetchCourses() {
      setIsLoadingFavorites(true);
      try {
        const codes = favorites;
        const results = await Promise.allSettled(
          codes.map((courseCode) => getCourseSummary(courseCode)),
        );
        const courses = results
          .filter((r) => r.status === "fulfilled")
          .map((r) => ({ ...r.value, isUserFavorite: true }));
        if (!cancelled) {
          setUserFavoriteCourses(courses);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingFavorites(false);
        }
      }
    }

    void fetchCourses();

    return () => {
      cancelled = true;
    };
  }, [favorites, isFavoritesLoading]);

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
