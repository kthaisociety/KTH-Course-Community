import { z } from "zod";
import { baseProcedure, createTRPCRouter } from "../api/trpc";
import { submitFeedback } from "./service";

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
