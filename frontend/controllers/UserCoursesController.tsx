"use client";

import type { CourseWithUserInfo } from "@shared/types";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useSessionData } from "@/hooks/sessionHooks";
import { useUser } from "@/hooks/userHooks";
import { getCourseSummary } from "@/lib/courses";
import { toggleUserFavorite } from "@/lib/user";
import type { Dispatch } from "@/state/store";
import { toggleFavoriteSuccess } from "@/state/user/userSlice";
import UserCoursesView from "@/views/UserCoursesView";

export default function UserCoursesController() {
  const { isLoading: isSessionLoading } = useSessionData();
  const userData = useUser();
  const [userFavoriteCourses, setUserFavoriteCourses] = useState<
    CourseWithUserInfo[]
  >([]);
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(true);

  const router = useRouter();
  const dispatch = useDispatch<Dispatch>();

  const isListLoading = isSessionLoading || isLoadingFavorites;

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
      const res = await toggleUserFavorite(courseCode);

      dispatch(
        toggleFavoriteSuccess({
          courseCode: courseCode,
          action: res.action,
        }),
      );

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
    if (isSessionLoading) return;

    let cancelled = false;

    async function fetchCourses() {
      setIsLoadingFavorites(true);
      try {
        const codes = userData.userFavorites ?? [];
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
  }, [userData, isSessionLoading]);

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
