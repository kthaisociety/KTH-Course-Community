import { z } from "zod";
import { baseProcedure, createTRPCRouter } from "../api/trpc";
import {
  DEFAULT_SEARCH_PAGE_SIZE,
  getDepartments,
  searchCourses,
} from "./service";

export const searchRouter = createTRPCRouter({
  /**
   * One page of the catalogue, and whether another one follows it.
   *
   * `page` used to be accepted and dropped, and the reply carried
   * `total: results.length` — the size of the page it had just built, offered
   * as if it were the size of the matching set. Both are gone: `page` is
   * honoured, and `total` is not replaced by a truthful count because there is
   * no truthful count to compute over a de-duplicated union of a keyword
   * ranking and a semantic one. `service.ts` sets out why at length.
   *
   * What a prev/next pager actually asks is "is there another page", and
   * `hasMore` answers exactly that, from one extra row rather than a second
   * query.
   *
   * `page` is echoed back because it may not be the page that was asked for:
   * the service clamps it to the depth cap, so a hand-typed `?page=99` is
   * served as page 5 and says so. `size` is capped at the default rather than
   * left open — this is an unauthenticated procedure, and the window it fetches
   * is `page * size`, so an uncapped `size` would be a five-fold lever on the
   * cost of an anonymous request.
   */
  courses: baseProcedure
    .input(
      z.object({
        q: z.string(),
        page: z.number().int().positive().optional(),
        size: z
          .number()
          .int()
          .positive()
          .max(DEFAULT_SEARCH_PAGE_SIZE)
          .optional(),
        department: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const pageSize = input.size ?? DEFAULT_SEARCH_PAGE_SIZE;
      const { results, page, hasMore } = await searchCourses(input.q, {
        page: input.page,
        size: pageSize,
        department: input.department,
      });
      return {
        results,
        page,
        pageSize,
        hasMore,
      };
    }),
  departments: baseProcedure.query(async () => {
    const departments = await getDepartments();
    return { departmentCount: departments.length, departments };
  }),
});
