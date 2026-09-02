import { z } from "zod";
import { NotFoundError } from "@/server/errors";
import { getDetails, getSummary } from "@/server/services/course";
import { baseProcedure, createTRPCRouter } from "../trpc";

export const courseRouter = createTRPCRouter({
  summary: baseProcedure
    .input(z.object({ courseCode: z.string().min(1) }))
    .query(async ({ input }) => {
      const course = await getSummary(input.courseCode);
      if (!course) {
        throw new NotFoundError(
          `Course with code ${input.courseCode} not found in database.`,
        );
      }
      return course;
    }),
  details: baseProcedure
    .input(z.object({ courseCode: z.string().min(1) }))
    .query(async ({ input }) => {
      const course = await getDetails(input.courseCode);
      if (!course) {
        throw new NotFoundError(
          `Course with code ${input.courseCode} not found in database.`,
        );
      }
      return course;
    }),
});
