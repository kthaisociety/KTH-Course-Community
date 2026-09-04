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

/**
 * The viewer's collections, which the course card's picker ticks.
 *
 * `collections.list` is a `protectedProcedure`, so `enabled` waits for a
 * session: a visitor sees the design's sign-up prompt rather than sending a
 * request that would be rejected. Every card on a page shares this one query.
 */
export function useCollections(enabled: boolean) {
  const trpc = useTRPC();
  return useQuery(trpc.collections.list.queryOptions(undefined, { enabled }));
}

/** The viewer's taken courses. Protected, so it waits for a session too. */
export function useTakenCourses(enabled: boolean) {
  const trpc = useTRPC();
  return useQuery(trpc.taken.list.queryOptions(undefined, { enabled }));
}
