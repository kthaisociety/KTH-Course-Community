import {
  baseProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "../api/trpc";
import {
  getEffectiveTier,
  getNeighbourhood,
  getPublicWindow,
  joinCommunityGraph,
} from "./service";

/**
 * Reading the community graph.
 *
 * Everything about a *person* is protected: a neighbourhood is centred on the
 * caller's own node, and a tier belongs to the caller. `publicWindow` is the
 * one exception and is public on purpose — the landing hero draws the real
 * community to anybody who loads `/`, so a visitor has to be able to ask for
 * it. It is centred on the community origin, it names nobody, and the service
 * strips every user id out of what it returns.
 */
export const graphRouter = createTRPCRouter({
  join: protectedProcedure.mutation(({ ctx }) =>
    joinCommunityGraph(ctx.session.user.id),
  ),
  neighbourhood: protectedProcedure.query(({ ctx }) =>
    getNeighbourhood(ctx.session.user.id),
  ),
  publicWindow: baseProcedure.query(() => getPublicWindow()),
  effectiveTier: protectedProcedure.query(({ ctx }) =>
    getEffectiveTier(ctx.session.user.id),
  ),
});
