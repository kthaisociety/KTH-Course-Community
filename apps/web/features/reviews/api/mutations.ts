"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTRPC } from "@/trpc/client";

export function useCreateReview() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation(
    trpc.reviews.create.mutationOptions({
      onSuccess: (_data, { courseCode }) => {
        void queryClient.invalidateQueries({
          queryKey: trpc.reviews.list.queryKey({ courseCode }),
        });
        router.refresh();
      },
    }),
  );
}

/**
 * `reviews.update` and `reviews.delete` both refuse anyone but the review's
 * author, server-side. The course code is the caller's because the procedures
 * take only a review id, and it is the list that has to be refetched.
 */
export function useUpdateReview(courseCode: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation(
    trpc.reviews.update.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.reviews.list.queryKey({ courseCode }),
        });
        router.refresh();
      },
    }),
  );
}

export function useDeleteReview(courseCode: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation(
    trpc.reviews.delete.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.reviews.list.queryKey({ courseCode }),
        });
        router.refresh();
      },
    }),
  );
}

export function useVoteOnReview(courseCode: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation(
    trpc.reviews.vote.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.reviews.list.queryKey({ courseCode }),
        });
        router.refresh();
      },
    }),
  );
}
