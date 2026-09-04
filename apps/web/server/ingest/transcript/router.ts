import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../../api/trpc";
import { confirmTranscriptImport } from "./service";

/**
 * A transcript is a single student's record; nobody has more results on one
 * than this. The bound is here to keep a hostile client from asking the write
 * path to touch an unbounded number of rows, not to judge the transcript.
 */
const MAX_CONFIRMED_COURSES = 300;

/**
 * Grade and credits are self-reported even when they came off a transcript, so
 * these bounds are length limits only. There is deliberately no list of valid
 * grades and no check that the credits match the catalogue.
 */
const confirmedCourse = z.object({
  courseCode: z.string().trim().min(2).max(16),
  grade: z.string().trim().max(16).nullish(),
  earnedCredits: z.number().nonnegative().max(1000).nullish(),
  attendanceYear: z.number().int().min(1900).max(2200).nullish(),
});

export const transcriptRouter = createTRPCRouter({
  /**
   * Writes the courses the user picked out of a proposal. The proposal itself
   * comes back from `POST /api/user/transcript`, which parses the uploaded file
   * without storing it.
   */
  confirm: protectedProcedure
    .input(
      z.object({
        courses: z.array(confirmedCourse).max(MAX_CONFIRMED_COURSES),
      }),
    )
    .mutation(({ ctx, input }) =>
      confirmTranscriptImport(ctx.session.user.id, input.courses, new Date()),
    ),
});
