import { z } from "zod";
import {
  createReview,
  findAllReviews,
  findOneReview,
  removeReview,
  toggleVote,
  updateReview,
} from "@/server/reviews";
import { baseProcedure, createTRPCRouter, protectedProcedure } from "../init";

const reviewInput = z.object({
  examinationMethods: z.number().int(),
  theoreticalVsApplied: z.number().int(),
  workload: z.number().int(),
  learningExperience: z.number().int(),
  wouldRecommend: z.boolean(),
  content: z.string(),
});

export const reviewsRouter = createTRPCRouter({
  list: baseProcedure
    .input(z.object({ courseCode: z.string().optional() }))
    .query(({ ctx, input }) =>
      findAllReviews(ctx.db, input.courseCode, ctx.session?.user.id),
    ),
  byId: baseProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(({ ctx, input }) => findOneReview(ctx.db, input.id)),
  create: protectedProcedure
    .input(reviewInput.extend({ courseCode: z.string().min(1) }))
    .mutation(({ ctx, input }) => {
      const { courseCode, ...reviewData } = input;
      return createReview(ctx.db, courseCode, ctx.session.user.id, reviewData);
    }),
  update: protectedProcedure
    .input(reviewInput.extend({ id: z.string().min(1) }))
    .mutation(({ ctx, input }) => {
      const { id, ...reviewData } = input;
      return updateReview(ctx.db, id, ctx.session.user.id, reviewData);
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(({ ctx, input }) =>
      removeReview(ctx.db, input.id, ctx.session.user.id),
    ),
  like: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(({ ctx, input }) =>
      toggleVote(ctx.db, input.id, ctx.session.user.id, "like"),
    ),
});
