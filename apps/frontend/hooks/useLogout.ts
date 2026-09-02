"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { authClient } from "@/lib/auth-client";

export function useLogout() {
  const queryClient = useQueryClient();

  return useCallback(async () => {
    await authClient.signOut();
    queryClient.clear();
    window.location.href = "/";
  }, [queryClient]);
}
