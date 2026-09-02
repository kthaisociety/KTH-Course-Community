import { createTRPCRouter } from "../init";
import { courseRouter } from "./course";
import { feedbackRouter } from "./feedback";
import { healthRouter } from "./health";
import { reviewsRouter } from "./reviews";
import { searchRouter } from "./search";
import { userRouter } from "./user";

export const appRouter = createTRPCRouter({
  course: courseRouter,
  search: searchRouter,
  reviews: reviewsRouter,
  user: userRouter,
  feedback: feedbackRouter,
  health: healthRouter,
});

export type AppRouter = typeof appRouter;
