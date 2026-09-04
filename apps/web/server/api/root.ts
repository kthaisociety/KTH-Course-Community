import { collectionsRouter } from "../collections/router";
import { courseRouter } from "../course/router";
import { feedbackRouter } from "../feedback/router";
import { graphRouter } from "../graph/router";
import { healthRouter } from "../health/router";
import { transcriptRouter } from "../ingest/transcript/router";
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
  graph: graphRouter,
  feedback: feedbackRouter,
  health: healthRouter,
  transcript: transcriptRouter,
});

export type AppRouter = typeof appRouter;
