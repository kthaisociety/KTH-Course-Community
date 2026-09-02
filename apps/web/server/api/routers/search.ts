import { z } from "zod";
import { getDepartments, searchCourses } from "@/server/search";
import { baseProcedure, createTRPCRouter } from "../trpc";

export const searchRouter = createTRPCRouter({
  courses: baseProcedure
    .input(
      z.object({
        q: z.string(),
        page: z.number().int().positive().optional(),
        size: z.number().int().positive().optional(),
        department: z.string().optional(),
        minRating: z.number().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const page = input.page && input.page > 0 ? input.page : 1;
      const pageSize = input.size ?? 10;
      const results = await searchCourses(ctx.db, input.q, pageSize, {
        department: input.department,
        minRating: input.minRating,
      });
      return {
        results,
        total: results.length,
        page,
        pageSize,
      };
    }),
  departments: baseProcedure.query(async ({ ctx }) => {
    const departments = await getDepartments(ctx.db);
    return { departmentCount: departments.length, departments };
  }),
});
