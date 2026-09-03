import { baseProcedure, createTRPCRouter } from "../api/trpc";
import { testAll } from "./service";

export const healthRouter = createTRPCRouter({
  check: baseProcedure.query(() => testAll()),
});
