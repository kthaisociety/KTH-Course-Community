import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import * as schema from "../db/schema";

export type ReviewRecord = typeof schema.reviews.$inferSelect;

export type ReviewWrite = {
  examinationMethods: number;
  theoreticalVsApplied: number;
  workload: number;
  learningExperience: number;
  wouldRecommend: boolean;
  content: string;
};

export async function insertReview(
  values: ReviewWrite & { id: string; userId: string; courseCode: string },
) {
  const [inserted] = await db.insert(schema.reviews).values(values).returning();
  return inserted;
}

export async function listReviews(courseCode?: string, userId?: string) {
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

  return courseCode
    ? await baseQuery.where(eq(schema.reviews.courseCode, courseCode))
    : await baseQuery;
}

export async function findById(id: string): Promise<ReviewRecord | undefined> {
  const [review] = await db
    .select()
    .from(schema.reviews)
    .where(eq(schema.reviews.id, id))
    .limit(1);
  return review;
}

export async function updateById(id: string, reviewData: ReviewWrite) {
  const [updated] = await db
    .update(schema.reviews)
    .set({
      ...reviewData,
      updatedAt: sql`now()`,
    })
    .where(eq(schema.reviews.id, id))
    .returning();
  return updated;
}

export async function deleteById(id: string) {
  const [deleted] = await db
    .delete(schema.reviews)
    .where(eq(schema.reviews.id, id))
    .returning();
  return deleted;
}

export async function findVote(reviewId: string, userId: string) {
  const [vote] = await db
    .select()
    .from(schema.reviewLikes)
    .where(
      and(
        eq(schema.reviewLikes.reviewId, reviewId),
        eq(schema.reviewLikes.userId, userId),
      ),
    )
    .limit(1);
  return vote;
}

export async function insertVote(
  reviewId: string,
  userId: string,
  voteType: "like" | "dislike",
) {
  await db.insert(schema.reviewLikes).values({
    userId,
    reviewId,
    voteType,
  });
}

export async function updateVote(
  reviewId: string,
  userId: string,
  voteType: "like" | "dislike",
) {
  await db
    .update(schema.reviewLikes)
    .set({ voteType })
    .where(
      and(
        eq(schema.reviewLikes.reviewId, reviewId),
        eq(schema.reviewLikes.userId, userId),
      ),
    );
}

export async function deleteVote(reviewId: string, userId: string) {
  await db
    .delete(schema.reviewLikes)
    .where(
      and(
        eq(schema.reviewLikes.reviewId, reviewId),
        eq(schema.reviewLikes.userId, userId),
      ),
    );
}
