"use client";

import { useTRPC } from "@/trpc/client";

export function useUserQueries() {
  const trpc = useTRPC();

  return {
    me: () => trpc.user.me.queryOptions(),
  };
}
