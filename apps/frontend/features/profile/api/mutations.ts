"use client";

import { useTRPC } from "@/trpc/client";

export function useProfileMutations() {
  const trpc = useTRPC();

  return {
    remove: () => trpc.user.delete.mutationOptions(),
  };
}
