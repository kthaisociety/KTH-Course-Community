import { z } from "zod";
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
      findAllReviews(input.courseCode, ctx.session?.user.id),
    ),
  byId: baseProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(({ input }) => findOneReview(input.id)),
  create: protectedProcedure
    .input(reviewInput.extend({ courseCode: z.string().min(1) }))
    .mutation(({ ctx, input }) => {
      const { courseCode, ...reviewData } = input;
      return createReview(courseCode, ctx.session.user.id, reviewData);
    }),
  update: protectedProcedure
    .input(reviewInput.extend({ id: z.string().min(1) }))
    .mutation(({ ctx, input }) => {
      const { id, ...reviewData } = input;
      return updateReview(id, ctx.session.user.id, reviewData);
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(({ ctx, input }) => removeReview(input.id, ctx.session.user.id)),
  like: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(({ ctx, input }) =>
      toggleVote(input.id, ctx.session.user.id, "like"),
    ),
});
