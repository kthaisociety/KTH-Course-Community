"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { type RouterOutputs, useTRPC } from "@/trpc/client";

export type CourseDetails = RouterOutputs["course"]["details"];
export type CourseSummary = RouterOutputs["course"]["summary"];

export function useCourseDetails(courseCode: string | undefined) {
  const trpc = useTRPC();
  return useQuery(
    trpc.course.details.queryOptions(
      { courseCode: courseCode ?? "" },
      { enabled: Boolean(courseCode) },
    ),
  );
}

export function useCourseSummaries(courseCodes: string[], enabled = true) {
  const trpc = useTRPC();
  return useQueries({
    queries: courseCodes.map((courseCode) =>
      trpc.course.summary.queryOptions({ courseCode }, { enabled }),
    ),
  });
}
