import { nanoid } from "nanoid";
import type { Review, ReviewInput, ReviewVoteType } from "@/types";
import { reviewInputSchema } from "@/types";
import { ForbiddenError, NotFoundError, ValidationError } from "../errors";
import * as reviewsRepo from "./repository";

export type { ReviewInput };
export type ReviewAggregate = reviewsRepo.ReviewAggregateRow;

/**
 * What the reviewers of each of these courses said, reduced to one row per
 * course. Courses with no reviews are absent from the result rather than
 * present with zeroes — "nobody has reviewed this" is not a score of nought.
 *
 * The course domain composes these into the numbers a course card renders;
 * this is the reviews domain's own aggregate, so the queries over `reviews`
 * stay where the table lives.
 */
export function getAggregatesByCourseCodes(
  courseCodes: string[],
): Promise<ReviewAggregate[]> {
  return reviewsRepo.findAggregatesByCourseCodes(courseCodes);
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function serializeReview(
  row: reviewsRepo.ReviewRecord & Partial<reviewsRepo.ReviewWithVotes>,
): Review {
  return {
    id: row.id,
    userId: row.userId,
    courseCode: row.courseCode,
    examinationDistribution: row.examinationDistribution ?? null,
    approachTheoryPercent: row.approachTheoryPercent ?? null,
    workloadScore: row.workloadScore,
    learningScore: row.learningScore,
    happyTook: row.happyTook,
    message: row.message ?? null,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
    upvoteCount: Number(row.upvoteCount ?? 0),
    downvoteCount: Number(row.downvoteCount ?? 0),
    userVote: row.userVote ?? null,
  };
}

/**
 * The last gate before the target columns. It enforces the shared contract —
 * 1-10 scores, a distribution that adds up to 100 — and normalizes a blank
 * message to `null`. A `null` recollection is left alone: that is how "I don't
 * remember" is stored, and filling it with zeroes would claim an answer the
 * reviewer never gave.
 *
 * The router already fed the same `reviewInputSchema` to `.input()`, so over
 * tRPC this parse is deliberately redundant. It stays because the service is
 * the enforcement point `planned-database-formats.md` names, and because the
 * service is called directly by tests and by any future caller that is not a
 * tRPC procedure. One schema, checked twice — not two sources of truth.
 */
function validateReviewInput(input: ReviewInput): ReviewInput {
  const parsed = reviewInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues[0]?.message ?? "Invalid review",
    );
  }

  return {
    ...parsed.data,
    message: parsed.data.message?.trim() ? parsed.data.message : null,
  };
}

export async function createReview(
  courseCode: string,
  userId: string,
  reviewData: ReviewInput,
) {
  const inserted = await reviewsRepo.insertReview({
    id: nanoid(),
    userId,
    courseCode,
    ...validateReviewInput(reviewData),
  });
  return serializeReview(inserted);
}

export async function findAllReviews(
  courseCode?: string,
  userId?: string,
): Promise<Review[]> {
  const rows = await reviewsRepo.listReviews(courseCode, userId);
  return rows.map(serializeReview);
}

export async function findOneReview(id: string) {
  const review = await reviewsRepo.findById(id);
  if (!review) throw new NotFoundError(`Review with id ${id} not found`);
  return serializeReview(review);
}

export async function updateReview(
  id: string,
  userId: string,
  reviewData: ReviewInput,
) {
  await assertAuthor(id, userId);
  const updated = await reviewsRepo.updateById(
    id,
    validateReviewInput(reviewData),
  );
  if (!updated) throw new NotFoundError(`Review with id ${id} not found`);
  return serializeReview(updated);
}

export async function removeReview(id: string, userId: string) {
  await assertAuthor(id, userId);
  const deleted = await reviewsRepo.deleteById(id);
  if (!deleted) throw new NotFoundError(`Review with id ${id} not found`);
  return serializeReview(deleted);
}

/**
 * Voting the same way twice takes the vote back; voting the other way flips
 * it. The read only decides which of those the caller meant — the write itself
 * is a set or a remove, both idempotent, so two racing requests agree instead
 * of one of them failing on the composite key. `planned-database-formats.md`
 * asks for exactly that: "idempotent set/remove operations".
 */
export async function toggleVote(
  reviewId: string,
  voterUserId: string,
  voteType: ReviewVoteType,
) {
  const existingVote = await reviewsRepo.findVote(reviewId, voterUserId);

  if (existingVote?.voteType === voteType) {
    await reviewsRepo.deleteVote(reviewId, voterUserId);
    return { action: "removed" as const, voteType: null };
  }

  await reviewsRepo.upsertVote(reviewId, voterUserId, voteType);
  return {
    action: existingVote ? ("updated" as const) : ("added" as const),
    voteType,
  };
}

async function assertAuthor(reviewId: string, userId: string) {
  const review = await findOneReview(reviewId);
  if (review.userId !== userId) {
    throw new ForbiddenError("You can only change your own review");
  }
}
