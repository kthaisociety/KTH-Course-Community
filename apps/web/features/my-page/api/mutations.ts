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
