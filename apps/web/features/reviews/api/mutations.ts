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
