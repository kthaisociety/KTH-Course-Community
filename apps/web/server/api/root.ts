import { courseRouter } from "../course/router";
import { feedbackRouter } from "../feedback/router";
import { graphRouter } from "../graph/router";
import { healthRouter } from "../health/router";
import { reviewsRouter } from "../reviews/router";
import { searchRouter } from "../search/router";
import { userRouter } from "../user/router";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  course: courseRouter,
  search: searchRouter,
  reviews: reviewsRouter,
  user: userRouter,
  graph: graphRouter,
  feedback: feedbackRouter,
  health: healthRouter,
});

export type AppRouter = typeof appRouter;
