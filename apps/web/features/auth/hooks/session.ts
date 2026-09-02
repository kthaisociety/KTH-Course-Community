"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { authClient } from "@/lib/auth-client";

export function useSessionData() {
  const { data, isPending, refetch } = authClient.useSession();
  return {
    user: data?.user ?? null,
    userId: data?.user.id ?? "",
    session: data?.session,
    isAuthenticated: !!data,
    isPending: isPending,
    refetch,
  };
}

export function useRequireSession() {
  const session = useSessionData();
  const { user, isPending } = session;
  const router = useRouter();
  const wasSignedIn = useRef(false);

  useEffect(() => {
    if (user) wasSignedIn.current = true;
  }, [user]);

  useEffect(() => {
    if (isPending || user) return;
    if (wasSignedIn.current) return;
    router.replace("/auth");
  }, [isPending, user, router]);

  return session;
}
