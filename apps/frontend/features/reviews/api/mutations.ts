"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

export function useCreateReview() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.reviews.create.mutationOptions({
      onSuccess: (_data, { courseCode }) => {
        void queryClient.invalidateQueries({
          queryKey: trpc.reviews.list.queryKey({ courseCode }),
        });
      },
    }),
  );
}

export function useLikeReview(courseCode: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.reviews.like.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.reviews.list.queryKey({ courseCode }),
        });
      },
    }),
  );
}
