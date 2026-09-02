import { testAll } from "@/server/health";
import { baseProcedure, createTRPCRouter } from "../trpc";

export const healthRouter = createTRPCRouter({
  check: baseProcedure.query(({ ctx }) => testAll(ctx.db)),
});
