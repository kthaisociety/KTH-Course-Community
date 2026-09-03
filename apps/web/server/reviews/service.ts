import { nanoid } from "nanoid";
import type { Review, ReviewInput, ReviewVoteType } from "@/types";
import { reviewInputSchema } from "@/types";
import { ForbiddenError, NotFoundError, ValidationError } from "../errors";
import * as reviewsRepo from "./repository";

export type { ReviewInput };

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

export async function toggleVote(
  reviewId: string,
  voterUserId: string,
  voteType: ReviewVoteType,
) {
  const existingVote = await reviewsRepo.findVote(reviewId, voterUserId);

  if (existingVote) {
    if (existingVote.voteType === voteType) {
      await reviewsRepo.deleteVote(reviewId, voterUserId);
      return { action: "removed" as const, voteType: null };
    }
    await reviewsRepo.updateVote(reviewId, voterUserId, voteType);
    return { action: "updated" as const, voteType };
  }

  await reviewsRepo.insertVote(reviewId, voterUserId, voteType);
  return { action: "added" as const, voteType };
}

async function assertAuthor(reviewId: string, userId: string) {
  const review = await findOneReview(reviewId);
  if (review.userId !== userId) {
    throw new ForbiddenError("You can only change your own review");
  }
}
