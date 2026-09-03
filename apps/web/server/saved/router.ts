import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../api/trpc";
import { listSavedCourseCodes, saveCourse, unsaveCourse } from "./service";

const savedCourseInput = z.object({ courseCode: z.string().min(1) });

export const savedRouter = createTRPCRouter({
  list: protectedProcedure.query(({ ctx }) =>
    listSavedCourseCodes(ctx.session.user.id),
  ),
  save: protectedProcedure
    .input(savedCourseInput)
    .mutation(({ ctx, input }) =>
      saveCourse(ctx.session.user.id, input.courseCode),
    ),
  unsave: protectedProcedure
    .input(savedCourseInput)
    .mutation(({ ctx, input }) =>
      unsaveCourse(ctx.session.user.id, input.courseCode),
    ),
});
