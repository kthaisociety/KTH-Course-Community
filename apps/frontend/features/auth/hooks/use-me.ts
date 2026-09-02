"use client";

import { useMeQuery } from "../api/queries";

export function useMe() {
  const query = useMeQuery();

  return {
    user: query.data ?? null,
    isLoading: query.isLoading,
    isAuthenticated: query.data != null,
    userId: query.data?.userId ?? "",
    error: query.error,
  };
}
