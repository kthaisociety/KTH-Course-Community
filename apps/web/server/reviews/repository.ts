import { and, count, eq, inArray, sql } from "drizzle-orm";
import type { EXAMINATION_DISTRIBUTION_KEYS } from "@/types";
import type { ReviewInput, ReviewVoteType } from "@/types/review";
import { db } from "../db";
import * as schema from "../db/schema";

export type ReviewRecord = typeof schema.reviews.$inferSelect;

type ExaminationKey = (typeof EXAMINATION_DISTRIBUTION_KEYS)[number];

/**
 * One course's reviews, reduced by PostgreSQL. Means arrive unrounded and
 * unscaled; deciding display precision is the caller's business.
 *
 * `AVG` and `COUNT(column)` both ignore SQL `NULL`, which is exactly the rule
 * "I don't remember" needs: a reviewer who did not answer is left out of the
 * mean instead of being counted as a zero. The `*AnswerCount` fields are how
 * many reviewers did answer, so the UI can say what a mean is over.
 */
export type ReviewAggregateRow = {
  courseCode: string;
  reviewCount: number;
  happyCount: number;
  workloadMean: number;
  learningMean: number;
  /** `null` when no reviewer of this course remembered. */
  approachTheoryMean: number | null;
  approachTheoryAnswerCount: number;
  examinationAnswerCount: number;
  /** `null` when no reviewer of this course remembered. */
  examinationMeans: Record<ExaminationKey, number> | null;
};

/**
 * The mean of one examination share across the reviews that recorded a
 * distribution at all.
 *
 * The `CASE` keeps every key averaged over the same denominator: a row with no
 * distribution drops out of all six means, but a row that has one contributes
 * to all six even if a key were somehow missing from the stored object. Were
 * each key averaged independently, the six means could end up over different
 * sets of reviewers and no longer add up to 100.
 */
function examinationShareMean(key: ExaminationKey) {
  return sql<string | null>`avg(
    case
      when ${schema.reviews.examinationDistribution} is not null
      then coalesce((${schema.reviews.examinationDistribution} ->> ${key}::text)::numeric, 0)
    end
  )`;
}

/** `numeric` and `bigint` come back from the driver as strings. */
function toNumber(value: string | number | null): number {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function toNullableNumber(value: string | number | null): number | null {
  return value === null ? null : toNumber(value);
}

/**
 * One grouped query for a whole page of course cards, not one per card.
 * Courses with no reviews are simply missing from the result — the caller
 * turns that absence into "no reviews yet".
 */
export async function findAggregatesByCourseCodes(
  courseCodes: string[],
): Promise<ReviewAggregateRow[]> {
  if (courseCodes.length === 0) return [];

  const rows = await db
    .select({
      courseCode: schema.reviews.courseCode,
      reviewCount: count(),
      happyCount: sql<string>`count(*) filter (where ${schema.reviews.happyTook})`,
      workloadMean: sql<string>`avg(${schema.reviews.workloadScore})`,
      learningMean: sql<string>`avg(${schema.reviews.learningScore})`,
      approachTheoryMean: sql<
        string | null
      >`avg(${schema.reviews.approachTheoryPercent})`,
      approachTheoryAnswerCount: sql<string>`count(${schema.reviews.approachTheoryPercent})`,
      examinationAnswerCount: sql<string>`count(${schema.reviews.examinationDistribution})`,
      examMean: examinationShareMean("exam"),
      assignmentsMean: examinationShareMean("assignments"),
      labsMean: examinationShareMean("labs"),
      projectsMean: examinationShareMean("projects"),
      seminarsMean: examinationShareMean("seminars"),
      otherMean: examinationShareMean("other"),
    })
    .from(schema.reviews)
    .where(inArray(schema.reviews.courseCode, courseCodes))
    .groupBy(schema.reviews.courseCode);

  return rows.map((row) => ({
    courseCode: row.courseCode,
    reviewCount: toNumber(row.reviewCount),
    happyCount: toNumber(row.happyCount),
    workloadMean: toNumber(row.workloadMean),
    learningMean: toNumber(row.learningMean),
    approachTheoryMean: toNullableNumber(row.approachTheoryMean),
    approachTheoryAnswerCount: toNumber(row.approachTheoryAnswerCount),
    examinationAnswerCount: toNumber(row.examinationAnswerCount),
    examinationMeans:
      row.examMean === null
        ? null
        : {
            exam: toNumber(row.examMean),
            assignments: toNumber(row.assignmentsMean),
            labs: toNumber(row.labsMean),
            projects: toNumber(row.projectsMean),
            seminars: toNumber(row.seminarsMean),
            other: toNumber(row.otherMean),
          },
  }));
}

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

/**
 * Sets this voter's vote on this review, whether or not they had one. It is a
 * single conflict-aware statement rather than a read then a write: two
 * requests racing on a first vote (a double-click is enough) would otherwise
 * have one of them rejected by the composite primary key.
 */
export async function upsertVote(
  reviewId: string,
  voterUserId: string,
  voteType: ReviewVoteType,
) {
  await db
    .insert(schema.reviewVotes)
    .values({ voterUserId, reviewId, voteType })
    .onConflictDoUpdate({
      target: [schema.reviewVotes.voterUserId, schema.reviewVotes.reviewId],
      set: { voteType, updatedAt: sql`now()` },
    });
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
