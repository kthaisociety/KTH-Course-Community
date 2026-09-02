"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import Session from "supertokens-auth-react/recipe/session";
import { initST } from "@/lib/supertokens.client";

export function useLogout() {
  const queryClient = useQueryClient();

  return useCallback(async () => {
    initST();
    await Session.signOut();
    queryClient.clear();
    window.location.href = "/";
  }, [queryClient]);
}
