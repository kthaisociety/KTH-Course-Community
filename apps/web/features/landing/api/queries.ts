"use client";

import { useQuery } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import type { AppRouter } from "@/server/api/root";
import { type RouterOutputs, useTRPC } from "@/trpc/client";

/** A bounded slice of the community graph around the signed-in app user. */
export type Neighbourhood = RouterOutputs["graph"]["neighbourhood"];

/**
 * The app user is signed in but has no node in the community graph yet.
 *
 * `graph.neighbourhood` is personal — every read is relative to the caller's own
 * node — so "not found" here means one thing only: nobody has placed them.
 * Placement is `graph.join`'s job and nothing calls it yet, which makes this the
 * state every member actually sees today, not an edge case.
 */
export function isUnplaced(error: unknown): boolean {
  return (
    isTRPCClientError<AppRouter>(error) && error.data?.code === "NOT_FOUND"
  );
}

/**
 * Read the caller's own neighbourhood.
 *
 * Off by default: a visitor has no session and the procedure is protected, so
 * asking before they are signed in would only ever earn a 401. Retries are off
 * because the one error worth showing — being unplaced — is not transient.
 */
export function useNeighbourhood(enabled: boolean) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.graph.neighbourhood.queryOptions(),
    enabled,
    retry: false,
  });
}
