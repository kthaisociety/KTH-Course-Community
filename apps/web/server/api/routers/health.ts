import { testAll } from "@/server/services/health";
import { baseProcedure, createTRPCRouter } from "../trpc";

export const healthRouter = createTRPCRouter({
  check: baseProcedure.query(() => testAll()),
});
