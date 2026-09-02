"use client";

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
