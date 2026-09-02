import { courseRouter } from "./routers/course";
import { feedbackRouter } from "./routers/feedback";
import { healthRouter } from "./routers/health";
import { reviewsRouter } from "./routers/reviews";
import { searchRouter } from "./routers/search";
import { userRouter } from "./routers/user";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  course: courseRouter,
  search: searchRouter,
  reviews: reviewsRouter,
  user: userRouter,
  feedback: feedbackRouter,
  health: healthRouter,
});

export type AppRouter = typeof appRouter;
