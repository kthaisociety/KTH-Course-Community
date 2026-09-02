"use client";

import { useTRPC } from "@/trpc/client";

export function useFeedbackMutations() {
  const trpc = useTRPC();

  return {
    submit: () => trpc.feedback.submit.mutationOptions(),
  };
}
