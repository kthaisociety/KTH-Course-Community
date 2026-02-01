"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useSessionData } from "@/hooks/sessionHooks";
import { useUser } from "@/hooks/userHooks";
import { getFullCourseInfo } from "@/lib/courses";
import { toggleUserFavorite } from "@/lib/user";
import type { Course, CourseWithUserInfo } from "@/models/CourseModel";
import type { Dispatch } from "@/state/store";
import { toggleFavoriteSuccess } from "@/state/user/userSlice";
import SuspenseView from "@/views/SuspenseView";
import UserCoursesView from "@/views/UserCoursesView";

export default function UserpageController() {
  const { isLoading } = useSessionData();
  const userData = useUser(); // userData instead of userFavorites to check user state as well
  const [userFavoriteCourses, setUserFavoriteCourses] = useState<
    CourseWithUserInfo[]
  >([]); // the full course objects sent down to the view
  const [isLoadingCourse, setIsLoadingCourse] = useState(false);

  const router = useRouter();
  const dispatch = useDispatch<Dispatch>(); // connect between redux and the component

  const onSeeReviews = (courseCode: string) => {
    router.push(`/course/${courseCode}`);
  };

  async function onToggleFavorite(courseCode: string) {
    try {
      const res = await toggleUserFavorite(courseCode);

      dispatch(
        toggleFavoriteSuccess({
          courseCode: courseCode,
          action: res.action, // will be "added" or "removed"
        }),
      );

      if (res.action === "added") {
        const course = await getFullCourseInfo(courseCode);
        setUserFavoriteCourses((prev) => {
          // If the course is already in the array, return a copy of the *existing* array
          // to ensure a new reference is always returned, even if no content changed.
          if (prev.some((c) => c.courseCode === courseCode)) {
            return [...prev]; // FIX: Return a new array reference (shallow copy)
          }
          // Otherwise, add the new course
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

  // Maps the course codes in to full Course objects
  useEffect(() => {
    if (!userData) return;
    async function fetchCourses() {
      setIsLoadingCourse(true);
      const courses = await Promise.all(
        (userData.userFavorites ?? []).map(
          async (courseCode) => {
            const course: Course = await getFullCourseInfo(courseCode);
            return { ...course, isUserFavorite: true };
          }, // perhaps rename this property to be ID instead of favoriteCourse?
        ),
      );
      setUserFavoriteCourses(courses);
      setIsLoadingCourse(false);
    }
    fetchCourses();
  }, [userData]);

  // Returns suspense view but could be improved to always render skeleton on all updates
  if (!userData || isLoading || !userFavoriteCourses) {
    return <SuspenseView />;
  }
  return (
    <UserCoursesView
      userFavoriteCourses={userFavoriteCourses} // array of CourseWithUserInfo object
      isLoadingCourse={isLoadingCourse}
      onSeeReviews={onSeeReviews}
      onToggleFavorite={onToggleFavorite}
    />
  );
}
