"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { authClient } from "@/lib/auth-client";

export function useSessionData() {
  // fetches the session-data from Nest via Better Auth.
  const { data, isPending, refetch } = authClient.useSession();
  return {
    user: data?.user ?? null,
    userId: data?.user.id ?? "",
    session: data?.session,
    isAuthenticated: !!data,
    isPending: isPending,
    // Re-reads the session from the server. Needed after mutations that change
    // fields Better Auth owns (e.g. the profile image), so the cached session
    // does not go stale.
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
 * This is still not authorisation. The Nest `AuthGuard` remains the only real
 * enforcement; this exists so the user lands on sign-in instead of an empty page.
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
    // Still fetching: redirecting here would bounce every load.
    if (isPending || user) return;
    // The session went from present to null while this page was open, which
    // means a deliberate sign-out (Navbar) or account deletion. Those handlers
    // do their own navigation; racing them with a second one lands the user on
    // an arbitrary page.
    if (wasSignedIn.current) return;
    router.replace("/auth");
  }, [isPending, user, router]);

  return session;
}
