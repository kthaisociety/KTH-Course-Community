"use client";

import { useQuery } from "@tanstack/react-query";
import { useUserQueries } from "../api/queries";

export function useMe() {
  const user = useUserQueries();
  const query = useQuery({
    ...user.me(),
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
