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

/**
 * Client-side companion to the `proxy.ts` route gate.
 *
 * The proxy is deliberately optimistic (D12): it only checks that the session
 * cookie *exists*, so a stale or expired cookie gets past it and the page
 * renders with a null session. This hook closes that gap by redirecting once
 * the session has actually resolved to null.
 *
 * `isPending` must be respected — without it every first load would redirect
 * during the initial session fetch. `replace` rather than `push` keeps the
 * page the user could not see out of the back-button history.
 *
 * This is still not authorisation. tRPC `protectedProcedure` remains the only
 * real enforcement; this exists so the user lands on sign-in instead of an empty page.
 */
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
