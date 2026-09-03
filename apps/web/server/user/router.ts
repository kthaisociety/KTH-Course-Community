import {
  baseProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "../api/trpc";
import { deleteUser, getSavedCourseCodes } from "./service";

export const userRouter = createTRPCRouter({
  me: baseProcedure.query(async ({ ctx }) => {
    if (!ctx.session?.user) return null;
    const { id, name, email, image } = ctx.session.user;
    return {
      userId: id,
      name,
      email,
      image: image ?? null,
      savedCourseCodes: await getSavedCourseCodes(id),
    };
  }),
  delete: protectedProcedure.mutation(async ({ ctx }) => {
    await deleteUser(ctx.session.user.id);
    return { success: true as const };
  }),
});
