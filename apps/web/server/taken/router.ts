import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../api/trpc";
import {
  addTakenCourse,
  listTakenCourses,
  removeTakenCourse,
  updateTakenCourse,
} from "./service";

const courseCode = z.string().min(1);

/**
 * Self-reported fields. `null` clears one; omitting one is the same as clearing
 * it, because a write always specifies the whole row.
 */
const takenCourseInput = z.object({
  courseCode,
  grade: z.string().min(1).max(16).nullish(),
  earnedCredits: z.number().nonnegative().max(1000).nullish(),
  attendancePeriods: z.string().min(1).max(64).nullish(),
  attendanceYear: z.number().int().min(1900).max(2200).nullish(),
});

export const takenRouter = createTRPCRouter({
  list: protectedProcedure.query(({ ctx }) =>
    listTakenCourses(ctx.session.user.id),
  ),
  add: protectedProcedure
    .input(takenCourseInput)
    .mutation(({ ctx, input }) => addTakenCourse(ctx.session.user.id, input)),
  update: protectedProcedure
    .input(takenCourseInput)
    .mutation(({ ctx, input }) =>
      updateTakenCourse(ctx.session.user.id, input),
    ),
  remove: protectedProcedure
    .input(z.object({ courseCode }))
    .mutation(({ ctx, input }) =>
      removeTakenCourse(ctx.session.user.id, input.courseCode),
    ),
});
