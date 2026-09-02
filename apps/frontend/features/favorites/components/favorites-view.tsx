"use client";

import type { CourseWithUserInfo } from "@shared/types";
import {
  getMockChartData,
  getMockCourseStats,
  getMockKeywords,
  getMockPrerequisites,
  getMockSummary,
} from "@/data/courseCardMockData";
import { CourseCardWithCharts, CourseItemSkeleton } from "@/features/courses";

const SKELETON_KEYS = ["f0", "f1", "f2", "f3", "f4"] as const;

interface FavoritesViewProps {
  userFavoriteCourses: CourseWithUserInfo[];
  isListLoading: boolean;
  onCardClick: (courseCode: string) => void;
  onWriteReview: (courseCode: string) => void;
  onToggleFavorite: (courseCode: string) => void;
  onAddToComparison: (courseCode: string) => void;
}

export function FavoritesView({
  userFavoriteCourses,
  isListLoading,
  onCardClick,
  onWriteReview,
  onToggleFavorite,
  onAddToComparison,
}: FavoritesViewProps) {
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
                  goals={""}
                  content={""}
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
          <p className="rounded-lg border border-dashed border-border bg-muted/20 px-6 py-12 text-center text-muted-foreground text-sm">
            You have no saved courses yet. Save courses from explore to see them
            here.
          </p>
        )}
      </div>
    </div>
  );
}
