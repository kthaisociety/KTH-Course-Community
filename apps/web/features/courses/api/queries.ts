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
 * The card numbers for a whole page of courses in one call.
 *
 * `course.stats` answers for every code it is given, so a code missing from the
 * result never happened — a screen still needs `NO_COURSE_STATS` for the window
 * before the batch settles. Explore asks for its whole result set at once, which
 * is what the procedure's 200-code cap is sized for.
 */
export function useCourseStats(courseCodes: string[]) {
  const trpc = useTRPC();
  return useQuery(
    trpc.course.stats.queryOptions(
      { courseCodes },
      { enabled: courseCodes.length > 0 },
    ),
  );
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
