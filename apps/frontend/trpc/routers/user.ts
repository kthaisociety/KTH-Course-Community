import { z } from "zod";
import {
  deleteUser,
  getUserFavorites,
  toggleUserFavorite,
} from "@/server/user";
import { baseProcedure, createTRPCRouter, protectedProcedure } from "../init";

export const userRouter = createTRPCRouter({
  me: baseProcedure.query(async ({ ctx }) => {
    if (!ctx.session?.user) return null;
    const { id, name, email, image } = ctx.session.user;
    return {
      userId: id,
      name,
      email,
      image: image ?? null,
      userFavorites: await getUserFavorites(ctx.db, id),
    };
  }),
  favorites: protectedProcedure.query(({ ctx }) =>
    getUserFavorites(ctx.db, ctx.session.user.id),
  ),
  toggleFavorite: protectedProcedure
    .input(z.object({ courseCode: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const result = await toggleUserFavorite(
        ctx.db,
        ctx.session.user.id,
        input.courseCode,
      );
      return { success: true as const, action: result.action };
    }),
  delete: protectedProcedure.mutation(async ({ ctx }) => {
    await deleteUser(ctx.db, ctx.session.user.id);
    return { success: true as const };
  }),
});
