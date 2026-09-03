import { createTRPCRouter, protectedProcedure } from "../api/trpc";
import {
  getEffectiveTier,
  getNeighbourhood,
  joinCommunityGraph,
} from "./service";

/**
 * The community graph is personal: every read is relative to the caller's own
 * node, so there is nothing here a visitor could ask for.
 */
export const graphRouter = createTRPCRouter({
  join: protectedProcedure.mutation(({ ctx }) =>
    joinCommunityGraph(ctx.session.user.id),
  ),
  neighbourhood: protectedProcedure.query(({ ctx }) =>
    getNeighbourhood(ctx.session.user.id),
  ),
  effectiveTier: protectedProcedure.query(({ ctx }) =>
    getEffectiveTier(ctx.session.user.id),
  ),
});
