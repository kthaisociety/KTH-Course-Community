"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

export function useMe() {
  const trpc = useTRPC();
  const query = useQuery({
    ...trpc.user.me.queryOptions(),
    retry: false,
  });

  return {
    user: query.data ?? null,
    isLoading: query.isLoading,
    isAuthenticated: query.data != null,
    userId: query.data?.userId ?? "",
    error: query.error,
  };
}
