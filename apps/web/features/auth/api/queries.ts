"use client";

import { useQuery } from "@tanstack/react-query";
import { type RouterOutputs, useTRPC } from "@/trpc/client";

export type Me = RouterOutputs["user"]["me"];

export function useMeQuery() {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.user.me.queryOptions(),
    retry: false,
  });
}
