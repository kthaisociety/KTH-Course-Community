"use client";

import { useCallback } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
 *
 * The shell is {@link ConfirmDialog} — the artboard's confirmation — rather than
 * the stock `AlertDialog` this used to render. That gave `max-w-xs`, `p-4`, a
 * 16px/500 title, no eyebrow and a `bg-muted/50` footer bar the design never
 * draws, at the destructive moment.
 */
export function DeleteReviewDialog({ pending, onClose }: Props) {
  const removeReview = useRemoveReview();

  const confirm = useCallback(async () => {
    onClose();
    await removeReview(pending.id);
  }, [onClose, pending.id, removeReview]);

  return (
    <ConfirmDialog
      request={{
        eyebrow: "My reviews",
        title: "Delete this review?",
        body: `This removes your review of ${pending.courseCode} — the scores, the examination split and the write-up — from the course, along with the votes it collected. It cannot be undone.`,
        cancelLabel: "Keep review",
        actionLabel: "Delete review",
      }}
      onCancel={onClose}
      onConfirm={() => void confirm()}
    />
  );
}
