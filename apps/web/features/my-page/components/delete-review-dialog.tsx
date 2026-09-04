"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useRemoveReview } from "@/features/reviews";
import { useTRPC } from "@/trpc/client";

/** Which review is pending: `reviews.delete` needs the id, the cache needs the course. */
export type PendingDelete = { id: string; courseCode: string };

type Props = {
  pending: PendingDelete;
  onClose: () => void;
};

/**
 * Deleting one of the viewer's own reviews from My Page.
 *
 * Mounted only while a review is pending, because `useRemoveReview` is keyed by
 * course code and this page's reviews span many courses. It invalidates the
 * unfiltered `reviews.list` as well — the hook refetches the course's own list,
 * which is not the list this page is reading.
 */
export function DeleteReviewDialog({ pending, onClose }: Props) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const removeReview = useRemoveReview(pending.courseCode);

  const confirm = useCallback(async () => {
    onClose();
    const removed = await removeReview(pending.id);
    if (removed) {
      // No input: the procedure-level key is a prefix, so every `reviews.list`
      // is refetched — this page's unfiltered one included.
      await queryClient.invalidateQueries({
        queryKey: trpc.reviews.list.queryKey(),
      });
    }
  }, [onClose, pending.id, queryClient, removeReview, trpc.reviews.list]);

  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this review?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes your review of {pending.courseCode} — the scores, the
            examination split and the write-up — from the course, along with the
            votes it collected. It cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep review</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => void confirm()}
          >
            Delete review
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
