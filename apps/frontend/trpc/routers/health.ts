import { testAll } from "@/server/health";
import { baseProcedure, createTRPCRouter } from "../init";

export const healthRouter = createTRPCRouter({
  check: baseProcedure.query(({ ctx }) => testAll(ctx.db)),
});
