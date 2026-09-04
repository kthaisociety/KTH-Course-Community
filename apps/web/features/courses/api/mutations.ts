"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

/**
 * Creating a collection, and moving one course in or out of it.
 *
 * Each write refetches `collections.list`, which is what the picker's ticks are
 * drawn from — there is no second copy of that state to keep in step. All three
 * procedures are protected, so the card only reaches them once a session exists.
 */
export function useCollectionMutations() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const listKey = trpc.collections.list.queryKey();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: listKey });

  const create = useMutation(
    trpc.collections.create.mutationOptions({ onSuccess: invalidate }),
  );
  const addCourse = useMutation(
    trpc.collections.addCourse.mutationOptions({ onSuccess: invalidate }),
  );
  const removeCourse = useMutation(
    trpc.collections.removeCourse.mutationOptions({ onSuccess: invalidate }),
  );

  return { create, addCourse, removeCourse };
}

/**
 * Marks a course taken.
 *
 * `taken.add` upserts on (user, course), so a repeat click cannot duplicate a
 * row. Grade, credits and periods are left unset: the card asks none of them,
 * and an omitted field is stored as null rather than as 0.
 *
 * Nothing here touches the course's prerequisites. A prerequisite tick means the
 * viewer separately marked *that* course taken; cascading would fabricate
 * academic history, which `CONTEXT.md` forbids by holding taken courses to be
 * self-reported (#68).
 */
export function useMarkCourseTaken() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const takenKey = trpc.taken.list.queryKey();
  // The card's taken count comes from the same table, so it is stale the moment
  // this succeeds. `queryKey()` with no input matches every batch of stats.
  const statsKey = trpc.course.stats.queryKey();

  return useMutation(
    trpc.taken.add.mutationOptions({
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: takenKey }),
          queryClient.invalidateQueries({ queryKey: statsKey }),
        ]);
      },
    }),
  );
}
