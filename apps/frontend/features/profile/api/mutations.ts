"use client";

import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

export function useDeleteAccount() {
  const trpc = useTRPC();
  return useMutation(trpc.user.delete.mutationOptions());
}
