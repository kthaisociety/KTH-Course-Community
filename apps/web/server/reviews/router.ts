import { z } from "zod";
import { reviewInputSchema, reviewVoteTypeSchema } from "@/types";
import {
  baseProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "../api/trpc";
import {
  createReview,
  findAllReviews,
  findOneReview,
  removeReview,
  toggleVote,
  updateReview,
} from "./service";

export const reviewsRouter = createTRPCRouter({
  list: baseProcedure
    .input(z.object({ courseCode: z.string().optional() }))
    .query(({ ctx, input }) =>
      findAllReviews(input.courseCode, ctx.session?.user.id),
    ),
  byId: baseProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(({ input }) => findOneReview(input.id)),
  create: protectedProcedure
    .input(reviewInputSchema.extend({ courseCode: z.string().min(1) }))
    .mutation(({ ctx, input }) => {
      const { courseCode, ...reviewData } = input;
      return createReview(courseCode, ctx.session.user.id, reviewData);
    }),
  update: protectedProcedure
    .input(reviewInputSchema.extend({ id: z.string().min(1) }))
    .mutation(({ ctx, input }) => {
      const { id, ...reviewData } = input;
      return updateReview(id, ctx.session.user.id, reviewData);
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(({ ctx, input }) => removeReview(input.id, ctx.session.user.id)),
  vote: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        voteType: reviewVoteTypeSchema,
      }),
    )
    .mutation(({ ctx, input }) =>
      toggleVote(input.id, ctx.session.user.id, input.voteType),
    ),
});
