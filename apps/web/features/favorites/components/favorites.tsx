"use client";

import { Bookmark } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  getMockChartData,
  getMockCourseStats,
  getMockKeywords,
  getMockPrerequisites,
  getMockSummary,
} from "@/data/courseCardMockData";
import { useMe, useRequireSession } from "@/features/auth";
import {
  CourseCardWithCharts,
  CourseItemSkeleton,
  useCourseSummaries,
} from "@/features/courses";
import type { CourseWithUserInfo } from "@/types";
import { useSetCourseSaved } from "../api/mutations";

const SKELETON_KEYS = ["f0", "f1", "f2", "f3", "f4"] as const;

export function Favorites() {
  useRequireSession();
  const { user, isLoading: isSessionLoading } = useMe();
  const { setSaved } = useSetCourseSaved();
  const router = useRouter();
  const codes = user?.savedCourseCodes ?? [];
  const summaryQueries = useCourseSummaries(codes, !isSessionLoading);

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

  // Every course on this screen is saved, so the only move here is unsaving.
  async function onToggleFavorite(courseCode: string) {
    try {
      await setSaved(courseCode, false);
    } catch (err) {
      console.error("Failed to unsave course:", err);
    }
  }

  return (
    <div className="centered flex w-full flex-col items-center gap-8 pb-12">
      <div className="w-full max-w-4xl px-4 pt-6">
        <h1 className="mb-6 self-start text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          Saved courses
        </h1>

        {isListLoading && (
          <ul className="flex flex-col gap-4">
            {SKELETON_KEYS.map((key) => (
              <li key={key}>
                <CourseItemSkeleton />
              </li>
            ))}
          </ul>
        )}

        {!isListLoading && userFavoriteCourses.length > 0 && (
          <ul className="flex flex-col gap-4">
            {userFavoriteCourses.map((course) => (
              <li key={course.courseCode}>
                <CourseCardWithCharts
                  title={course.titleEng}
                  summary={getMockSummary(course.courseCode)}
                  courseCode={course.courseCode}
                  department={course.department}
                  hp={course.credits}
                  keywords={getMockKeywords(course.courseCode)}
                  prerequisites={getMockPrerequisites(course.courseCode)}
                  chartData={getMockChartData(course.courseCode)}
                  stats={getMockCourseStats(course.courseCode)}
                  isUserFavorite={course.isUserFavorite}
                  onCardClick={() => onCardClick(course.courseCode)}
                  onWriteReview={() => onWriteReview(course.courseCode)}
                  onToggleFavorite={() => onToggleFavorite(course.courseCode)}
                  onAddToComparison={() => onAddToComparison(course.courseCode)}
                />
              </li>
            ))}
          </ul>
        )}

        {!isListLoading && userFavoriteCourses.length === 0 && (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Bookmark />
              </EmptyMedia>
              <EmptyTitle>No saved courses</EmptyTitle>
              <EmptyDescription>
                You have no saved courses yet. Save courses from explore to see
                them here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </div>
  );
}
