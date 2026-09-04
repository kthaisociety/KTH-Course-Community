import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../api/trpc";
import {
  addCourseToCollection,
  createCollection,
  deleteCollection,
  listCollections,
  removeCourseFromCollection,
  renameCollection,
  reorderCollectionCourses,
} from "./service";

const collectionId = z.string().min(1);
const courseCode = z.string().min(1);
const collectionName = z.string().trim().min(1).max(100);

export const collectionsRouter = createTRPCRouter({
  list: protectedProcedure.query(({ ctx }) =>
    listCollections(ctx.session.user.id),
  ),
  create: protectedProcedure
    .input(z.object({ name: collectionName }))
    .mutation(({ ctx, input }) =>
      createCollection(ctx.session.user.id, input.name),
    ),
  rename: protectedProcedure
    .input(z.object({ collectionId, name: collectionName }))
    .mutation(({ ctx, input }) =>
      renameCollection(ctx.session.user.id, input.collectionId, input.name),
    ),
  delete: protectedProcedure
    .input(z.object({ collectionId }))
    .mutation(({ ctx, input }) =>
      deleteCollection(ctx.session.user.id, input.collectionId),
    ),
  reorder: protectedProcedure
    .input(
      z.object({ collectionId, courseCodes: z.array(courseCode).max(500) }),
    )
    .mutation(({ ctx, input }) =>
      reorderCollectionCourses(
        ctx.session.user.id,
        input.collectionId,
        input.courseCodes,
      ),
    ),
  addCourse: protectedProcedure
    .input(z.object({ collectionId, courseCode }))
    .mutation(({ ctx, input }) =>
      addCourseToCollection(
        ctx.session.user.id,
        input.collectionId,
        input.courseCode,
      ),
    ),
  removeCourse: protectedProcedure
    .input(z.object({ collectionId, courseCode }))
    .mutation(({ ctx, input }) =>
      removeCourseFromCollection(
        ctx.session.user.id,
        input.collectionId,
        input.courseCode,
      ),
    ),
});
