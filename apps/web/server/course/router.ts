import { z } from "zod";
import { NotFoundError } from "@/server/errors";
import { baseProcedure, createTRPCRouter } from "../api/trpc";
import { getDetails, getStatsByCodes, getSummary } from "./service";

/**
 * An Explore page asks for its whole result set at once, so the cap is well
 * clear of any page size while still bounding what one anonymous request can
 * make the database group over.
 */
const MAX_STATS_BATCH = 200;

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
  /**
   * The card numbers for a page of courses in one call. Keyed by course code,
   * with an entry for every code asked for: `reviews: null` is "no reviews
   * yet", which the card renders differently from a course that scored zero.
   */
  stats: baseProcedure
    .input(
      z.object({
        courseCodes: z.array(z.string().min(1)).max(MAX_STATS_BATCH),
      }),
    )
    .query(async ({ input }) =>
      Object.fromEntries(await getStatsByCodes(input.courseCodes)),
    ),
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
