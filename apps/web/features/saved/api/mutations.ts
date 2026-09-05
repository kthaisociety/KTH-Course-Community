"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import type { Me } from "@/lib/user";
import { useTRPC } from "@/trpc/client";

/**
 * Saves or unsaves a course. The caller says which state it wants, because the
 * server has no toggle: `saved.save` and `saved.unsave` are separate and
 * idempotent.
 *
 * Writes to one course are queued, so the last click decides the stored state
 * even when a user clicks faster than the network answers. Two different
 * courses still go in parallel.
 *
 * ## Unsaving is also a collections write, and the cache has to know
 *
 * `collection_courses` carries a composite foreign key onto `user_saved_courses`
 * with `on delete cascade` (`collection_courses_saved_course_fk`), because a
 * course may only be in a collection its owner has also saved. So `saved.unsave`
 * removes the course from *every* collection it was in, on the server, without
 * `collections.removeCourse` ever being called.
 *
 * Nothing on the client can see that happen. Refetching `user.me` alone leaves
 * the card's picker still ticking a collection the course has just left, the
 * Saved page's chips still counting it, and an open collection's detail still
 * listing it — three surfaces disagreeing with the database after one click,
 * and the disagreement lasts until something else happens to invalidate the
 * list. `collections.list` is therefore refetched alongside `user.me`, so the
 * unsave means the same thing wherever it was pressed: Explore's Save button,
 * the Saved page's trash, or the trash on a card inside a collection.
 *
 * Saving does not need it. Adding a row to `user_saved_courses` makes a course
 * *eligible* for a collection; it never puts it in one.
 */
export function useSetCourseSaved() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const meKey = trpc.user.me.queryKey();
  const collectionsKey = trpc.collections.list.queryKey();

  const save = useMutation(trpc.saved.save.mutationOptions());
  const unsave = useMutation(trpc.saved.unsave.mutationOptions());

  // The write currently in flight per course code, so the next one can wait for
  // it instead of racing it.
  const inFlight = useRef(new Map<string, Promise<unknown>>());

  async function setSaved(courseCode: string, saved: boolean) {
    // Written before the first await so a second click in the same tick reads
    // the state this one is heading for, not the state it started from.
    const previous = queryClient.getQueryData<Me | null>(meKey);
    if (previous) {
      queryClient.setQueryData<Me>(meKey, {
        ...previous,
        savedCourseCodes: saved
          ? [...new Set([...previous.savedCourseCodes, courseCode])]
          : previous.savedCourseCodes.filter((code) => code !== courseCode),
      });
    }
    await queryClient.cancelQueries({ queryKey: meKey });

    const queue = inFlight.current;
    // A failed predecessor must not cancel this write, so its rejection is
    // swallowed here — it was already surfaced to whoever awaited it.
    const write = (queue.get(courseCode) ?? Promise.resolve())
      .catch(() => undefined)
      .then(() => (saved ? save : unsave).mutateAsync({ courseCode }));
    queue.set(courseCode, write);

    try {
      await write;
    } catch (error) {
      if (previous !== undefined) {
        queryClient.setQueryData(meKey, previous);
      }
      throw error;
    } finally {
      // Only the last write for this course clears the queue and refetches;
      // an earlier one must not pull server state back mid-sequence.
      if (queue.get(courseCode) === write) {
        queue.delete(courseCode);
        queryClient.invalidateQueries({ queryKey: meKey });
        if (!saved) {
          queryClient.invalidateQueries({ queryKey: collectionsKey });
        }
      }
    }
  }

  /**
   * Flips saved state. Reads the cache at call time rather than a value
   * captured by the caller's render, so clicking twice quickly ends in the
   * state the second click asked for.
   */
  function toggleSaved(courseCode: string) {
    const current = queryClient.getQueryData<Me | null>(meKey);
    const isSaved = current?.savedCourseCodes.includes(courseCode) ?? false;
    return setSaved(courseCode, !isSaved);
  }

  return {
    setSaved,
    toggleSaved,
    isPending: save.isPending || unsave.isPending,
  };
}
