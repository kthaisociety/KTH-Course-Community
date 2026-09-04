"use client";

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

/** Which review is pending: `reviews.delete` needs the id, the cache needs the course. */
export type PendingDelete = { id: string; courseCode: string };

type Props = {
  pending: PendingDelete;
  onClose: () => void;
};

/**
 * Deleting one of the viewer's own reviews from My Page.
 *
 * Mounted only while a review is pending, so the confirmation can name the
 * course the review is of. `useRemoveReview` refetches every `reviews.list`,
 * this page's unfiltered one included, so there is nothing to invalidate here.
 */
export function DeleteReviewDialog({ pending, onClose }: Props) {
  const removeReview = useRemoveReview();

  const confirm = useCallback(async () => {
    onClose();
    await removeReview(pending.id);
  }, [onClose, pending.id, removeReview]);

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
