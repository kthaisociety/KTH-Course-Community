import { z } from "zod";
import { submitFeedback } from "@/server/feedback";
import { baseProcedure, createTRPCRouter } from "../trpc";

export const feedbackRouter = createTRPCRouter({
  submit: baseProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        message: z.string().min(1),
      }),
    )
    .mutation(({ ctx, input }) => submitFeedback(ctx.db, input)),
});
