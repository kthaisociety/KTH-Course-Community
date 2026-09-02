"use client";

import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

export function useSubmitFeedback() {
  const trpc = useTRPC();
  return useMutation(trpc.feedback.submit.mutationOptions());
}
