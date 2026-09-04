"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { type RouterOutputs, useTRPC } from "@/trpc/client";
import type { CourseStats } from "@/types";

export type CourseDetails = RouterOutputs["course"]["details"];
export type CourseSummary = RouterOutputs["course"]["summary"];
/** One of the viewer's collections: its name, and its courses in stored order. */
export type Collection = RouterOutputs["collections"]["list"][number];

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
 * `course.stats` caps one request at `MAX_STATS_BATCH` codes
 * (`server/course/router.ts`), and a request over the cap is rejected whole. The
 * cap is sized for Explore, which asks for a bounded result set — but Saved asks
 * for however many courses one reader has kept, so past the cap it would lose
 * the numbers on *every* card rather than on the few beyond it. The codes are
 * split here rather than the cap being left as a cliff for a screen to fall off.
 */
const STATS_BATCH_SIZE = 200;

/**
 * The card numbers for a whole page of courses.
 *
 * `course.stats` answers for every code it is given, so a code missing from the
 * result never happened — a screen still needs `NO_COURSE_STATS` for the window
 * before the batches settle.
 *
 * `enabled` is for a screen whose codes are not known yet: Saved reads them off
 * `user.me`, and asking for the stats of an empty list while that resolves would
 * fetch, then immediately refetch.
 */
export function useCourseStats(courseCodes: string[], enabled = true) {
  const trpc = useTRPC();

  const batches: string[][] = [];
  for (let from = 0; from < courseCodes.length; from += STATS_BATCH_SIZE) {
    batches.push(courseCodes.slice(from, from + STATS_BATCH_SIZE));
  }

  return useQueries({
    queries: batches.map((batch) =>
      trpc.course.stats.queryOptions({ courseCodes: batch }, { enabled }),
    ),
    // One record keyed by course code, whatever it took to fetch. A batch still
    // in flight contributes nothing rather than an entry of zeroes, which is
    // what `NO_COURSE_STATS` is for at the call site.
    combine: (results) => ({
      data: Object.assign(
        {},
        ...results.map((result) => result.data ?? {}),
      ) as Record<string, CourseStats>,
      isPending: results.some((result) => result.isPending),
    }),
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
