"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMarkCourseTaken } from "@/features/courses";
import { useTRPC } from "@/trpc/client";

/**
 * Every write to a reader's own taken courses, in one hook.
 *
 * `add` is the courses feature's `useMarkCourseTaken` rather than a second
 * `taken.add` mutation: the course card already marks a course taken, and a
 * second copy would be a second set of cache keys to keep in step with the
 * first. The three writes added here invalidate exactly what it invalidates —
 * `taken.list`, which every taken surface reads, and `course.stats`, whose
 * taken count is drawn from the same table and is stale the moment any of
 * these succeeds.
 *
 * `confirmImport` is the only thing on this page that writes a transcript's
 * rows. Uploading and parsing write nothing at all; see `api/transcript.ts`.
 */
export function useTakenMutations() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const takenKey = trpc.taken.list.queryKey();
  // `queryKey()` with no input matches every batch of stats.
  const statsKey = trpc.course.stats.queryKey();

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: takenKey }),
      queryClient.invalidateQueries({ queryKey: statsKey }),
    ]);
  };

  const add = useMarkCourseTaken();
  const update = useMutation(
    trpc.taken.update.mutationOptions({ onSuccess: invalidate }),
  );
  const remove = useMutation(
    trpc.taken.remove.mutationOptions({ onSuccess: invalidate }),
  );
  const confirmImport = useMutation(
    trpc.transcript.confirm.mutationOptions({ onSuccess: invalidate }),
  );

  return { add, update, remove, confirmImport };
}
