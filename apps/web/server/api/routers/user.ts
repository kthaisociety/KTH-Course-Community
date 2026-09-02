import { z } from "zod";
import {
  deleteUser,
  getUserFavorites,
  toggleUserFavorite,
} from "@/server/services/user";
import { baseProcedure, createTRPCRouter, protectedProcedure } from "../trpc";

export const userRouter = createTRPCRouter({
  me: baseProcedure.query(async ({ ctx }) => {
    if (!ctx.session?.user) return null;
    const { id, name, email, image } = ctx.session.user;
    return {
      userId: id,
      name,
      email,
      image: image ?? null,
      userFavorites: await getUserFavorites(id),
    };
  }),
  favorites: protectedProcedure.query(({ ctx }) =>
    getUserFavorites(ctx.session.user.id),
  ),
  toggleFavorite: protectedProcedure
    .input(z.object({ courseCode: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const result = await toggleUserFavorite(
        ctx.session.user.id,
        input.courseCode,
      );
      return { success: true as const, action: result.action };
    }),
  delete: protectedProcedure.mutation(async ({ ctx }) => {
    await deleteUser(ctx.session.user.id);
    return { success: true as const };
  }),
});
