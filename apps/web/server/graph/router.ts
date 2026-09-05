import { z } from "zod";
import {
  baseProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "../api/trpc";
import {
  NODE_COLORS,
  NODE_SIGNAL_STYLES,
  NODE_STYLES,
  UNCONFIGURED,
} from "./appearance";
import {
  getNeighbourhood,
  getNodePersonalization,
  getPublicWindow,
  joinCommunityGraph,
  setNodeAppearance,
} from "./service";

/**
 * Reading the community graph, and choosing how your own node looks.
 *
 * Everything about a *person* is protected: a neighbourhood is centred on the
 * caller's own node, and a tier belongs to the caller. `publicWindow` is the
 * one exception and is public on purpose — the landing hero draws the real
 * community to anybody who loads `/`, so a visitor has to be able to ask for
 * it. It is centred on the community origin, it names nobody, and the service
 * strips every user id out of what it returns.
 */

/**
 * A choice on some of the three axes, each drawn from the one definition in
 * `./appearance.ts`.
 *
 * `UNCONFIGURED` is accepted on every axis because un-picking is a real choice:
 * a member who has earned a colour may go back to the community default, and
 * they would otherwise have no way to say so. Every axis is optional so the
 * picker can send exactly the one that was clicked, which is what lets a write
 * to one axis leave a dormant pick on another untouched.
 *
 * **This schema is not the gate.** It bounds the vocabulary; whether *this*
 * caller may set *this* axis is a question about their effective tier, and it
 * is answered in `setNodeAppearance`. A schema that a signed-in stranger can
 * satisfy is not an authorisation check.
 */
const appearanceChoice = z
  .object({
    color: z.enum([UNCONFIGURED, ...NODE_COLORS]).optional(),
    style: z.enum([UNCONFIGURED, ...NODE_STYLES]).optional(),
    signalStyle: z.enum([UNCONFIGURED, ...NODE_SIGNAL_STYLES]).optional(),
  })
  .strict();

export const graphRouter = createTRPCRouter({
  join: protectedProcedure.mutation(({ ctx }) =>
    joinCommunityGraph(ctx.session.user.id),
  ),
  neighbourhood: protectedProcedure.query(({ ctx }) =>
    getNeighbourhood(ctx.session.user.id),
  ),
  publicWindow: baseProcedure.query(() => getPublicWindow()),
  /**
   * How far the caller has unlocked their node profile, and what they picked.
   *
   * It answers with **both** tier numbers. One was not enough: the earned tier
   * is what separates a dormant axis from a locked one, and without it My Page
   * could only tell a member their axis was locked — which, for somebody who
   * earned it and went quiet, is a claim about their own history that the
   * database contradicts.
   */
  personalization: protectedProcedure.query(({ ctx }) =>
    getNodePersonalization(ctx.session.user.id),
  ),
  /**
   * Set one or more axes of the caller's own node.
   *
   * The app user is always `ctx.session.user.id` and never an id from the
   * input — there is no way to spell "somebody else's node" in this procedure.
   * The tier gate is the service's, deliberately: see `setNodeAppearance`.
   */
  setAppearance: protectedProcedure
    .input(appearanceChoice)
    .mutation(({ ctx, input }) =>
      setNodeAppearance(ctx.session.user.id, input),
    ),
});
