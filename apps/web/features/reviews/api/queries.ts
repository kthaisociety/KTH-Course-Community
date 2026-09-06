"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { useMe } from "@/features/auth";
// The module, not `@/features/courses`. The barrel reaches the course card,
// which reaches Saved, Collections and the workspace pane — and the pane
// imports this feature, so going through it would close a cycle back onto this
// file. `api/queries` imports nothing but the tRPC client.
import { useCourseSummaries } from "@/features/courses/api/queries";
import { type RouterOutputs, useTRPC } from "@/trpc/client";
import {
  reviewsWhenEveryListLoaded,
  selectUnreviewedCourses,
} from "../lib/unreviewed";

export type ReviewList = RouterOutputs["reviews"]["list"];

/**
 * One taken course as `taken.list` returns it: a code and self-reported facts.
 *
 * Re-exported from the feature that owns the relationship rather than declared
 * a third time. The module, not `@/features/taken`, because that barrel is
 * reachable from a component that imports this feature; `taken-rows` is types
 * only and cannot close a cycle.
 */
import type { TakenCourse } from "@/features/taken/lib/taken-rows";

export type { TakenCourse };

/**
 * A taken course with no review, and the catalogue title to draw it with.
 *
 * The title is part of the answer rather than each screen's to fetch:
 * `user_taken_courses` stores only a code, so a host that forgot the lookup
 * rendered the code twice — which is exactly what My Page did (#157). There is
 * one host fewer to remember now, and no second place for the join to diverge.
 *
 * `null` while `course.summary` is still in flight, or when it failed. The card
 * falls back to the code for it, which is why nothing here waits on a title:
 * a missing name is a worse row, a missing review list is a wrong one.
 */
export type UnreviewedTakenCourse = TakenCourse & { name: string | null };

export function useReviewList(courseCode: string | undefined) {
  const trpc = useTRPC();
  return useQuery(
    trpc.reviews.list.queryOptions(
      { courseCode: courseCode ?? "" },
      { enabled: Boolean(courseCode) },
    ),
  );
}

/**
 * The viewer's taken courses that they have not reviewed — the list
 * `UnreviewedCard` renders, shared by Taken courses and My Page.
 *
 * The difference is worked out here, in the client, deliberately: it is a
 * per-user set of at most a few dozen rows and #88 rules out a server procedure
 * for it. That costs one `reviews.list` per taken course, in the same shape
 * Saved already uses for `course.summary`. The cheaper-looking alternative —
 * one unfiltered `reviews.list` — was rejected: `reviews.list` has no author
 * filter, so it would ship every review in the database, with its author id,
 * to a browser in order to keep a handful.
 *
 * Rows stay hidden until every list has actually arrived. A course whose
 * reviews did not load is not "unreviewed", it is unknown — and that holds
 * whether the request is still in flight or has failed outright, which is why
 * `isLoading` alone does not gate the difference. Prompting someone to review a
 * course they already reviewed is the one mistake this card must not make, so
 * a list that failed leaves the set unavailable rather than empty.
 *
 * The catalogue title comes back with each course for the same reason the
 * difference does: it is the same join on both screens, and the host that had
 * to remember it was the host that forgot (#157).
 */
export function useUnreviewedTakenCourses(): {
  courses: UnreviewedTakenCourse[];
  isLoading: boolean;
  /**
   * A list did not load, so the difference cannot be told. Distinct from an
   * empty `courses`, which means everything taken has been reviewed.
   */
  isUnavailable: boolean;
} {
  const trpc = useTRPC();
  const { userId, isAuthenticated, isLoading: isSessionLoading } = useMe();

  const takenQuery = useQuery({
    ...trpc.taken.list.queryOptions(),
    enabled: isAuthenticated,
  });
  const takenCourses = takenQuery.data ?? [];

  const reviewQueries = useQueries({
    queries: takenCourses.map((course) =>
      trpc.reviews.list.queryOptions({ courseCode: course.courseCode }),
    ),
  });

  const isLoading =
    isSessionLoading ||
    (isAuthenticated && takenQuery.isPending) ||
    reviewQueries.some((query) => query.isPending);

  const reviews = reviewsWhenEveryListLoaded(
    reviewQueries.map((query) => query.data),
  );
  const isKnown = !isLoading && !takenQuery.isError && reviews !== null;

  const unreviewed = isKnown
    ? selectUnreviewedCourses(takenCourses, reviews, userId)
    : [];

  // Titles for the rows the card will actually draw, not for the whole taken
  // list: on `/taken` these are already in the cache under the same keys that
  // screen's own `useCourseSummaries` uses, so the join costs nothing there and
  // costs one request per unreviewed course on My Page, which had none.
  const summaries = useCourseSummaries(
    unreviewed.map((course) => course.courseCode),
    isAuthenticated,
  );
  const names = new Map(
    summaries.flatMap((query) =>
      query.data ? [[query.data.courseCode, query.data.titleEng] as const] : [],
    ),
  );

  return {
    courses: unreviewed.map((course) => ({
      ...course,
      name: names.get(course.courseCode) ?? null,
    })),
    isLoading,
    isUnavailable: !isLoading && !isKnown,
  };
}
