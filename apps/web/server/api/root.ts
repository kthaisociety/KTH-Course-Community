import { collectionsRouter } from "../collections/router";
import { courseRouter } from "../course/router";
import { feedbackRouter } from "../feedback/router";
import { healthRouter } from "../health/router";
import { reviewsRouter } from "../reviews/router";
import { savedRouter } from "../saved/router";
import { searchRouter } from "../search/router";
import { takenRouter } from "../taken/router";
import { userRouter } from "../user/router";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  course: courseRouter,
  search: searchRouter,
  reviews: reviewsRouter,
  saved: savedRouter,
  taken: takenRouter,
  collections: collectionsRouter,
  user: userRouter,
  feedback: feedbackRouter,
  health: healthRouter,
});

export type AppRouter = typeof appRouter;
