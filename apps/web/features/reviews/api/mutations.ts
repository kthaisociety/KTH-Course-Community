"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTRPC } from "@/trpc/client";

/**
 * Every `reviews.list` query, whatever input it was asked with.
 *
 * The procedure-level key is a prefix, so this covers the course page's
 * `{ courseCode }` list, the per-course lists `useUnreviewedTakenCourses`
 * fetches, and My Page's unfiltered `{}` one alike. Invalidating only
 * `{ courseCode }` does **not** reach the others — TanStack matches keys
 * structurally, and a more specific input is not a match for a less specific
 * one — so an edit made on one surface would leave the same review reading as
 * it did before on another.
 */
function useInvalidateReviewLists() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: trpc.reviews.list.queryKey() });
}

export function useCreateReview() {
  const invalidateReviewLists = useInvalidateReviewLists();
  const trpc = useTRPC();
  const router = useRouter();
  return useMutation(
    trpc.reviews.create.mutationOptions({
      onSuccess: () => {
        void invalidateReviewLists();
        router.refresh();
      },
    }),
  );
}

/**
 * `reviews.update` and `reviews.delete` both refuse anyone but the review's
 * author, server-side. Neither takes a course code — only a review id — and
 * neither needs one here either, because every list of reviews is refetched.
 */
export function useUpdateReview() {
  const invalidateReviewLists = useInvalidateReviewLists();
  const trpc = useTRPC();
  const router = useRouter();
  return useMutation(
    trpc.reviews.update.mutationOptions({
      onSuccess: () => {
        void invalidateReviewLists();
        router.refresh();
      },
    }),
  );
}

export function useDeleteReview() {
  const invalidateReviewLists = useInvalidateReviewLists();
  const trpc = useTRPC();
  const router = useRouter();
  return useMutation(
    trpc.reviews.delete.mutationOptions({
      onSuccess: () => {
        void invalidateReviewLists();
        router.refresh();
      },
    }),
  );
}

export function useVoteOnReview() {
  const invalidateReviewLists = useInvalidateReviewLists();
  const trpc = useTRPC();
  const router = useRouter();
  return useMutation(
    trpc.reviews.vote.mutationOptions({
      onSuccess: () => {
        void invalidateReviewLists();
        router.refresh();
      },
    }),
  );
}
