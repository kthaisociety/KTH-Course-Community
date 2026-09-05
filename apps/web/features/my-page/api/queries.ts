"use client";

import { useQuery } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import type { AppRouter } from "@/server/api/root";
import { type RouterOutputs, useTRPC } from "@/trpc/client";

/** One taken course as `taken.list` returns it. */
export type TakenCourse = RouterOutputs["taken"]["list"][number];

/** The viewer's taken courses. Protected, so it waits for a session. */
export function useTakenCourses(enabled: boolean) {
  const trpc = useTRPC();
  return useQuery(trpc.taken.list.queryOptions(undefined, { enabled }));
}

/**
 * Every published review, which is what `reviews.list` returns when it is given
 * no course code.
 *
 * My Page needs two sets out of it — the reviews the viewer wrote, and the ones
 * they upvoted — and `reviews.list` can filter by neither. It takes a course
 * code and a viewer, and the viewer is only used to fill in `userVote`. So the
 * page reads the list once and differences it in the browser.
 *
 * That is a real cost and it is stated plainly rather than hidden: the whole
 * `reviews` table crosses the wire, carrying each review's author id. The
 * author id is already public on this procedure — the course page's own list
 * has always returned it — so this adds no exposure, only volume, and the fix
 * is an author/vote filter on `reviews.list`, which is server work outside
 * #93. Do not paper over it with a second client-side cache.
 *
 * One list rather than one per course is what makes the upvoted set possible at
 * all: `userVote` comes back on every row, so "reviews I upvoted" is a real
 * server-side fact here instead of the `localStorage` array `cc-store.js`
 * keeps. There is no local vote state on this page.
 */
export function useAllReviews(enabled: boolean) {
  const trpc = useTRPC();
  return useQuery(trpc.reviews.list.queryOptions({}, { enabled }));
}

/** Both tier numbers and the stored appearance, as `graph.personalization` returns them. */
export type NodePersonalization = RouterOutputs["graph"]["personalization"];

/**
 * How far the viewer has unlocked their node profile, and what they picked.
 *
 * Read-only and derived: `users.personalization_tier_earned` holds the highest
 * tier ever reached and this never touches it. Retries are off because the one
 * error worth surfacing — no such app user — is not transient.
 *
 * It answers with **both** tier numbers because the tab has three states to
 * draw, not two. The effective tier says what may be edited; the earned tier is
 * only ever used to tell a **dormant** axis — earned, decayed, pick still in the
 * column — from a **locked** one that was never reached.
 */
export function useNodePersonalization(enabled: boolean) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.graph.personalization.queryOptions(),
    enabled,
    retry: false,
  });
}

/**
 * The app user has no row the tier could be derived from.
 *
 * #82 gives every account a graph node, so this is not the state a normal
 * account sits in; it is what an account deleted mid-session looks like, and
 * the "My dot" tab says so rather than drawing tier 0 as if it were measured.
 */
export function isTierUnavailable(error: unknown): boolean {
  return (
    isTRPCClientError<AppRouter>(error) && error.data?.code === "NOT_FOUND"
  );
}
