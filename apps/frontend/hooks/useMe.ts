"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { getMe } from "@/lib/user";

export function useMe() {
  const query = useQuery({
    queryKey: queryKeys.me,
    queryFn: getMe,
  });

  return {
    user: query.data ?? null,
    isLoading: query.isLoading,
    isAuthenticated: query.data != null,
    userId: query.data?.userId ?? "",
    error: query.error,
  };
}
