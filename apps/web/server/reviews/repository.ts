import { and, eq, sql } from "drizzle-orm";
import type { ReviewInput, ReviewVoteType } from "@/types/review";
import { db } from "../db";
import * as schema from "../db/schema";

export type ReviewRecord = typeof schema.reviews.$inferSelect;

/** The reviewer-supplied half of a review; the rest is identity and clock. */
export type ReviewWrite = ReviewInput;

/** A review row joined with its vote tallies and the caller's own vote. */
export type ReviewWithVotes = ReviewRecord & {
  upvoteCount: number | string | null;
  downvoteCount: number | string | null;
  userVote: ReviewVoteType | null;
};

export async function insertReview(
  values: ReviewWrite & { id: string; userId: string; courseCode: string },
) {
  const [inserted] = await db.insert(schema.reviews).values(values).returning();
  return inserted;
}

export async function listReviews(
  courseCode?: string,
  userId?: string,
): Promise<ReviewWithVotes[]> {
  const baseQuery = db
    .select({
      id: schema.reviews.id,
      userId: schema.reviews.userId,
      courseCode: schema.reviews.courseCode,
      examinationDistribution: schema.reviews.examinationDistribution,
      approachTheoryPercent: schema.reviews.approachTheoryPercent,
      workloadScore: schema.reviews.workloadScore,
      learningScore: schema.reviews.learningScore,
      happyTook: schema.reviews.happyTook,
      message: schema.reviews.message,
      createdAt: schema.reviews.createdAt,
      updatedAt: schema.reviews.updatedAt,
      upvoteCount: sql<number>`COALESCE(vote_counts.upvote_count, 0)`,
      downvoteCount: sql<number>`COALESCE(vote_counts.downvote_count, 0)`,
      userVote: schema.reviewVotes.voteType,
    })
    .from(schema.reviews)
    .leftJoin(
      sql`(
          SELECT
            review_id,
            COUNT(*) FILTER (WHERE vote_type = 'up') AS upvote_count,
            COUNT(*) FILTER (WHERE vote_type = 'down') AS downvote_count
          FROM ${schema.reviewVotes}
          GROUP BY review_id
        ) as vote_counts`,
      eq(schema.reviews.id, sql`vote_counts.review_id`),
    )
    .leftJoin(
      schema.reviewVotes,
      userId
        ? and(
            eq(schema.reviewVotes.reviewId, schema.reviews.id),
            eq(schema.reviewVotes.voterUserId, userId),
          )
        : sql`false`,
    )
    .orderBy(sql`${schema.reviews.createdAt} DESC`);

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

export async function findVote(
  reviewId: string,
  voterUserId: string,
): Promise<schema.SelectReviewVote | undefined> {
  const [vote] = await db
    .select()
    .from(schema.reviewVotes)
    .where(
      and(
        eq(schema.reviewVotes.reviewId, reviewId),
        eq(schema.reviewVotes.voterUserId, voterUserId),
      ),
    )
    .limit(1);
  return vote;
}

export async function insertVote(
  reviewId: string,
  voterUserId: string,
  voteType: ReviewVoteType,
) {
  await db.insert(schema.reviewVotes).values({
    voterUserId,
    reviewId,
    voteType,
  });
}

export async function updateVote(
  reviewId: string,
  voterUserId: string,
  voteType: ReviewVoteType,
) {
  await db
    .update(schema.reviewVotes)
    .set({ voteType, updatedAt: sql`now()` })
    .where(
      and(
        eq(schema.reviewVotes.reviewId, reviewId),
        eq(schema.reviewVotes.voterUserId, voterUserId),
      ),
    );
}

export async function deleteVote(reviewId: string, voterUserId: string) {
  await db
    .delete(schema.reviewVotes)
    .where(
      and(
        eq(schema.reviewVotes.reviewId, reviewId),
        eq(schema.reviewVotes.voterUserId, voterUserId),
      ),
    );
}
