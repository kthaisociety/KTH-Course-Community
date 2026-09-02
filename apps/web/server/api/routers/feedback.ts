import { z } from "zod";
import { submitFeedback } from "@/server/services/feedback";
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
    .mutation(({ input }) => submitFeedback(input)),
});
