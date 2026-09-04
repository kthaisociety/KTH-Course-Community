"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { useDeleteReview } from "../api/mutations";

/**
 * Deletes a review the viewer wrote. `reviews.delete` checks authorship itself,
 * so a request for someone else's review fails whatever the UI offered.
 */
export function useRemoveReview() {
  const deleteReview = useDeleteReview();

  return useCallback(
    async (id: string): Promise<boolean> => {
      try {
        await deleteReview.mutateAsync({ id });
        toast.success("Review deleted");
        return true;
      } catch {
        toast.error("Failed to delete review", {
          description: "Try again later",
        });
        return false;
      }
    },
    [deleteReview],
  );
}
