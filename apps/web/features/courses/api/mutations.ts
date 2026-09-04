"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { applyReorder } from "@/features/courses/lib/collection-order";
import { useTRPC } from "@/trpc/client";
import type { Collection } from "./queries";

/**
 * Every write in the `collections` router, in one hook.
 *
 * Two surfaces call these: the course card's picker, which puts *this* course
 * into a collection, and the Collections page, which manages the collections
 * themselves. They are different UIs over the same seven procedures, so the
 * write path is defined once — a second copy would be a second set of cache
 * keys to keep in step, and `collections.list` is the only state any of it has.
 *
 * Each write refetches `collections.list`, which is what the picker's ticks and
 * the page's grid are both drawn from. Every procedure is protected, so nothing
 * here is reached before a session exists.
 */
export function useCollectionMutations() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const listKey = trpc.collections.list.queryKey();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: listKey });

  const create = useMutation(
    trpc.collections.create.mutationOptions({ onSuccess: invalidate }),
  );
  const rename = useMutation(
    trpc.collections.rename.mutationOptions({ onSuccess: invalidate }),
  );
  const deleteCollection = useMutation(
    trpc.collections.delete.mutationOptions({ onSuccess: invalidate }),
  );
  const addCourse = useMutation(
    trpc.collections.addCourse.mutationOptions({ onSuccess: invalidate }),
  );
  const removeCourse = useMutation(
    trpc.collections.removeCourse.mutationOptions({ onSuccess: invalidate }),
  );

  /**
   * Reordering writes the new order into the cache before the request lands.
   *
   * Not for the animation: a reader nudging a course up twice computes the
   * second move from what is on screen, and without this that is still the
   * pre-move order — so the two clicks would send the same swap twice and the
   * course would move one place, not two.
   *
   * ## Why a failure does not roll back
   *
   * Nudging twice quickly puts two reorders in flight at once, and a snapshot
   * rollback is wrong for exactly that case: the first request's `onMutate`
   * captured the list as it was *before either* move, so restoring it when that
   * request fails also erases the second move — which may well be on its way to
   * succeeding. There is no snapshot that is right, because the state a
   * rollback should return to depends on writes that happened after it was
   * taken.
   *
   * So there is no rollback. `collections.reorder` rewrites every position in
   * one statement from the codes it is given, so the last request to reach the
   * server decides the order outright, and refetching is the only thing that
   * can be relied on to agree with it. A failed reorder shows its optimistic
   * order until that refetch lands — a moment, alongside the toast the caller
   * raises — rather than showing a different wrong order with more confidence.
   *
   * The refetch waits for the last reorder to settle. Invalidating while
   * another is still in flight would pull the pre-*that*-move order back over
   * its optimistic state, making the list jump backwards mid-gesture.
   */
  const pendingReorders = useRef(0);
  const reorder = useMutation(
    trpc.collections.reorder.mutationOptions({
      onMutate: async ({ collectionId, courseCodes }) => {
        pendingReorders.current += 1;
        await queryClient.cancelQueries({ queryKey: listKey });
        queryClient.setQueryData<Collection[]>(listKey, (collections) =>
          collections?.map((collection) =>
            collection.id === collectionId
              ? {
                  ...collection,
                  courseCodes: applyReorder(
                    collection.courseCodes,
                    courseCodes,
                  ),
                }
              : collection,
          ),
        );
      },
      onSettled: () => {
        pendingReorders.current -= 1;
        if (pendingReorders.current === 0) invalidate();
      },
    }),
  );

  return {
    create,
    rename,
    deleteCollection,
    reorder,
    addCourse,
    removeCourse,
  };
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
