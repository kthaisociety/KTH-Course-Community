"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { useMe } from "@/features/auth";
import { type RouterOutputs, useTRPC } from "@/trpc/client";
import {
  reviewsWhenEveryListLoaded,
  selectUnreviewedCourses,
} from "../lib/unreviewed";

export type ReviewList = RouterOutputs["reviews"]["list"];

/** One taken course as `taken.list` returns it: a code and self-reported facts. */
export type TakenCourse = RouterOutputs["taken"]["list"][number];

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
 */
export function useUnreviewedTakenCourses(): {
  courses: TakenCourse[];
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

  return {
    courses: isKnown
      ? selectUnreviewedCourses(takenCourses, reviews, userId)
      : [],
    isLoading,
    isUnavailable: !isLoading && !isKnown,
  };
}
