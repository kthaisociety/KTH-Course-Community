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

const percentage = z.number().int().min(0).max(100);

/**
 * `null` is the stored answer for "I don't remember"; the service rejects a
 * distribution that does not add up to 100.
 */
const examinationDistribution = z
  .object({
    exam: percentage,
    assignments: percentage,
    labs: percentage,
    projects: percentage,
    seminars: percentage,
    other: percentage,
  })
  .nullable();

const reviewInput = z.object({
  examinationDistribution,
  approachTheoryPercent: percentage.nullable(),
  workloadScore: z.number().int(),
  learningScore: z.number().int(),
  happyTook: z.boolean(),
  message: z.string().nullable(),
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
  vote: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        voteType: z.enum(["up", "down"]),
      }),
    )
    .mutation(({ ctx, input }) =>
      toggleVote(input.id, ctx.session.user.id, input.voteType),
    ),
});
