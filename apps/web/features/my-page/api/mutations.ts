"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useTRPC } from "@/trpc/client";
import type { TakenCourse } from "./queries";

export function useDeleteAccount() {
  const trpc = useTRPC();
  return useMutation(trpc.user.delete.mutationOptions());
}

/**
 * Choose how the viewer's own node looks.
 *
 * Sends only the axis that was clicked. An axis left out of the patch is left
 * exactly as it is in the column, which is what keeps a dormant pick on one axis
 * intact while another is edited.
 *
 * `graph.setAppearance` answers with the whole personalization state — both tier
 * numbers and every stored axis — so the cache is *replaced* with what the
 * server has rather than patched with what the click assumed. The two differ
 * whenever the server refuses, and the refusal is the point: the tier gate lives
 * there, and a picker that optimistically painted the choice would be showing a
 * member a colour their node does not have.
 */
export function useSetNodeAppearance() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.graph.setAppearance.mutationOptions({
      onSuccess: (personalization) => {
        queryClient.setQueryData(
          trpc.graph.personalization.queryKey(),
          personalization,
        );
        // The landing hero draws this node, so its window is now stale. It is
        // invalidated rather than written into: the window is anonymised per
        // response and there is no way to find this member's node in a cached
        // one — by design, and this is what that design costs.
        void queryClient.invalidateQueries({
          queryKey: trpc.graph.neighbourhood.queryKey(),
        });
      },
    }),
  );
}

/**
 * Turns grade storage off by actually removing the grades.
 *
 * There is no "store my grades" column on `users` — the setting is nothing but
 * whether any of the viewer's taken courses carries a grade, which is how the
 * artboard reads it too ("No separate 'are grades stored' flag — it's just
 * whether any row has one"). So switching it off has to clear the real column
 * on every row rather than flip a flag, or the grades would still be there the
 * next time anything read them.
 *
 * `taken.update` rewrites a whole row, so every other self-reported field is
 * sent back unchanged; only `grade` becomes null. The rows go one at a time and
 * the first failure stops the run, so a half-finished clear is reported as one
 * instead of being reported as success with grades still stored.
 */
export function useClearStoredGrades() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const update = useMutation(trpc.taken.update.mutationOptions());
  const { mutateAsync } = update;

  const clearGrades = useCallback(
    async (courses: readonly TakenCourse[]) => {
      const graded = courses.filter((course) => course.grade !== null);
      try {
        for (const course of graded) {
          await mutateAsync({
            courseCode: course.courseCode,
            grade: null,
            earnedCredits: course.earnedCredits,
            attendancePeriods: course.attendancePeriods,
            attendanceYear: course.attendanceYear,
          });
        }
      } finally {
        // Even a run that stopped part-way changed rows, so the list is refetched
        // whatever happened rather than only on the happy path.
        await queryClient.invalidateQueries({
          queryKey: trpc.taken.list.queryKey(),
        });
      }
    },
    [mutateAsync, queryClient, trpc.taken.list],
  );

  return { clearGrades, isPending: update.isPending };
}
