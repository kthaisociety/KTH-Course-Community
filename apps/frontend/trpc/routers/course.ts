import { z } from "zod";
import { getDetails, getSummary } from "@/server/course";
import { NotFoundError } from "@/server/errors";
import { baseProcedure, createTRPCRouter } from "../init";

export const courseRouter = createTRPCRouter({
  summary: baseProcedure
    .input(z.object({ courseCode: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const course = await getSummary(ctx.db, input.courseCode);
      if (!course) {
        throw new NotFoundError(
          `Course with code ${input.courseCode} not found in database.`,
        );
      }
      return course;
    }),
  details: baseProcedure
    .input(z.object({ courseCode: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const course = await getDetails(ctx.db, input.courseCode);
      if (!course) {
        throw new NotFoundError(
          `Course with code ${input.courseCode} not found in database.`,
        );
      }
      return course;
    }),
});
