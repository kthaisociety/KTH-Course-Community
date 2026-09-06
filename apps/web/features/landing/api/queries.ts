"use client";

import { useQuery } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import type { AppRouter } from "@/server/api/root";
import { type RouterOutputs, useTRPC } from "@/trpc/client";

/**
 * A bounded window on the community graph.
 *
 * The member read and the public read return the same shape on purpose: the
 * hero draws one graph, and which read produced it changes only whether one of
 * the nodes is flagged as the viewer's. Neither payload carries a user id —
 * every `id` in it is an opaque token generated for that response.
 */
export type GraphWindow = RouterOutputs["graph"]["publicWindow"];

/** The member read: the same window, centred on their own node. */
export type Neighbourhood = RouterOutputs["graph"]["neighbourhood"];

/**
 * The graph read reported that this app user has no node.
 *
 * **Nothing on the server produces this today.** `graph.neighbourhood` places
 * an app user who has no node rather than refusing them, so a member who once
 * saw the unplaced panel now sees their own neighbourhood instead. The branch
 * is kept because it is the only correct answer if that ever stops being true:
 * the alternative is drawing a dot somewhere the person is not. Deleting it, or
 * giving the read a real "no such app user" check to produce it, is a decision
 * for whoever next touches placement.
 */
export function isUnplaced(error: unknown): boolean {
  return (
    isTRPCClientError<AppRouter>(error) && error.data?.code === "NOT_FOUND"
  );
}

/**
 * Read the caller's own neighbourhood.
 *
 * Enabled as soon as there is a session, not when **Find your dot** opens: a
 * member's own neighbourhood *is* the hero now, so it is what the page draws on
 * load and the flow only labels a node that is already there. Retries are off
 * because the one error worth showing is not transient.
 */
export function useNeighbourhood(enabled: boolean) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.graph.neighbourhood.queryOptions(),
    enabled,
    retry: false,
  });
}

/**
 * Read the public window: the real graph around the community origin, for
 * somebody who has no node of their own to centre on.
 *
 * Unauthenticated, so a visitor gets the same community a member does — the
 * same positions, the same edges, and nobody named.
 */
export function usePublicWindow(enabled: boolean) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.graph.publicWindow.queryOptions(),
    enabled,
    retry: false,
  });
}
