import type { Review } from "@shared/types";
import { and, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Database } from "./db";
import * as schema from "./db/schema";
import { ForbiddenError, NotFoundError } from "./errors";

export type ReviewInput = {
  examinationMethods: number;
  theoreticalVsApplied: number;
  workload: number;
  learningExperience: number;
  wouldRecommend: boolean;
  content: string;
};

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function serializeReview(row: {
  id: string;
  userId: string;
  courseCode: string;
  examinationMethods: number;
  theoreticalVsApplied: number;
  workload: number;
  learningExperience: number;
  wouldRecommend: boolean;
  content: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  likeCount?: number | string | null;
  userVote?: string | null;
}): Review {
  const userVote = row.userVote;
  return {
    id: row.id,
    userId: row.userId,
    courseCode: row.courseCode,
    examinationMethods: row.examinationMethods,
    theoreticalVsApplied: row.theoreticalVsApplied,
    workload: row.workload,
    learningExperience: row.learningExperience,
    wouldRecommend: row.wouldRecommend,
    content: row.content,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
    likeCount: Number(row.likeCount ?? 0),
    userVote: userVote === "like" || userVote === "dislike" ? userVote : null,
  };
}

export async function createReview(
  db: Database,
  courseCode: string,
  userId: string,
  reviewData: ReviewInput,
) {
  const [inserted] = await db
    .insert(schema.reviews)
    .values({
      id: nanoid(),
      userId,
      courseCode,
      examinationMethods: reviewData.examinationMethods,
      theoreticalVsApplied: reviewData.theoreticalVsApplied,
      workload: reviewData.workload,
      learningExperience: reviewData.learningExperience,
      wouldRecommend: reviewData.wouldRecommend,
      content: reviewData.content,
    })
    .returning();
  return serializeReview(inserted);
}

export async function findAllReviews(
  db: Database,
  courseCode?: string,
  userId?: string,
): Promise<Review[]> {
  const baseQuery = db
    .select({
      id: schema.reviews.id,
      userId: schema.reviews.userId,
      courseCode: schema.reviews.courseCode,
      examinationMethods: schema.reviews.examinationMethods,
      theoreticalVsApplied: schema.reviews.theoreticalVsApplied,
      workload: schema.reviews.workload,
      learningExperience: schema.reviews.learningExperience,
      wouldRecommend: schema.reviews.wouldRecommend,
      content: schema.reviews.content,
      createdAt: schema.reviews.createdAt,
      updatedAt: schema.reviews.updatedAt,
      likeCount: sql<number>`COALESCE(like_counts.like_count, 0)`,
      userVote: schema.reviewLikes.voteType,
    })
    .from(schema.reviews)
    .leftJoin(
      sql`(
          SELECT review_id, COUNT(*) as like_count 
          FROM ${schema.reviewLikes} 
          WHERE vote_type = 'like' 
          GROUP BY review_id
        ) as like_counts`,
      eq(schema.reviews.id, sql`like_counts.review_id`),
    )
    .leftJoin(
      schema.reviewLikes,
      userId
        ? and(
            eq(schema.reviewLikes.reviewId, schema.reviews.id),
            eq(schema.reviewLikes.userId, userId),
          )
        : sql`false`,
    )
    .orderBy(sql`created_at DESC`);

  const rows = courseCode
    ? await baseQuery.where(eq(schema.reviews.courseCode, courseCode))
    : await baseQuery;

  return rows.map(serializeReview);
}

export async function findOneReview(db: Database, id: string) {
  const [review] = await db
    .select()
    .from(schema.reviews)
    .where(eq(schema.reviews.id, id))
    .limit(1);

  if (!review) throw new NotFoundError(`Review with id ${id} not found`);
  return serializeReview(review);
}

export async function updateReview(
  db: Database,
  id: string,
  userId: string,
  reviewData: ReviewInput,
) {
  await assertAuthor(db, id, userId);

  const [updated] = await db
    .update(schema.reviews)
    .set({
      examinationMethods: reviewData.examinationMethods,
      theoreticalVsApplied: reviewData.theoreticalVsApplied,
      workload: reviewData.workload,
      learningExperience: reviewData.learningExperience,
      wouldRecommend: reviewData.wouldRecommend,
      content: reviewData.content,
      updatedAt: sql`now()`,
    })
    .where(eq(schema.reviews.id, id))
    .returning();

  if (!updated) throw new NotFoundError(`Review with id ${id} not found`);
  return serializeReview(updated);
}

export async function removeReview(db: Database, id: string, userId: string) {
  await assertAuthor(db, id, userId);

  const [deleted] = await db
    .delete(schema.reviews)
    .where(eq(schema.reviews.id, id))
    .returning();

  if (!deleted) throw new NotFoundError(`Review with id ${id} not found`);
  return serializeReview(deleted);
}

export async function toggleVote(
  db: Database,
  reviewId: string,
  userId: string,
  voteType: "like" | "dislike",
) {
  const existingVote = await db
    .select()
    .from(schema.reviewLikes)
    .where(
      and(
        eq(schema.reviewLikes.reviewId, reviewId),
        eq(schema.reviewLikes.userId, userId),
      ),
    )
    .limit(1);

  if (existingVote.length > 0) {
    const currentVote = existingVote[0];

    if (currentVote.voteType === voteType) {
      await db
        .delete(schema.reviewLikes)
        .where(
          and(
            eq(schema.reviewLikes.reviewId, reviewId),
            eq(schema.reviewLikes.userId, userId),
          ),
        );
      return { action: "removed" as const, voteType: null };
    }
    await db
      .update(schema.reviewLikes)
      .set({ voteType })
      .where(
        and(
          eq(schema.reviewLikes.reviewId, reviewId),
          eq(schema.reviewLikes.userId, userId),
        ),
      );
    return { action: "updated" as const, voteType };
  }
  await db.insert(schema.reviewLikes).values({
    userId,
    reviewId,
    voteType,
  });
  return { action: "added" as const, voteType };
}

async function assertAuthor(db: Database, reviewId: string, userId: string) {
  const review = await findOneReview(db, reviewId);
  if (review.userId !== userId) {
    throw new ForbiddenError("You can only change your own review");
  }
}
