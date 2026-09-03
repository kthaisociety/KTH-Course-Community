import { z } from "zod";
import { NotFoundError } from "@/server/errors";
import { baseProcedure, createTRPCRouter } from "../api/trpc";
import { getDetails, getSummary } from "./service";

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
