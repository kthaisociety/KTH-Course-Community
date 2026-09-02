import { initTRPC, TRPCError } from "@trpc/server";
import { getAuth } from "@/server/auth";
import { ForbiddenError, NotFoundError } from "@/server/errors";

export const createTRPCContext = async (opts: { headers: Headers }) => {
  const session = await getAuth().api.getSession({ headers: opts.headers });
  return {
    session,
    headers: opts.headers,
  };
};

const t = initTRPC
  .context<Awaited<ReturnType<typeof createTRPCContext>>>()
  .create({
    errorFormatter(opts) {
      const { shape, error } = opts;
      const cause = error.cause;
      if (cause instanceof NotFoundError) {
        return { ...shape, message: cause.message };
      }
      if (cause instanceof ForbiddenError) {
        return { ...shape, message: cause.message };
      }
      return shape;
    },
  });

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const baseProcedure = t.procedure.use(async ({ next }) => {
  try {
    return await next();
  } catch (cause) {
    if (cause instanceof NotFoundError) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: cause.message,
        cause,
      });
    }
    if (cause instanceof ForbiddenError) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: cause.message,
        cause,
      });
    }
    throw cause;
  }
});

export const protectedProcedure = baseProcedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  });
});
