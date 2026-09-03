import { nanoid } from "nanoid";
import type { ExaminationDistribution, Review, ReviewVoteType } from "@/types";
import { EXAMINATION_DISTRIBUTION_KEYS } from "@/types";
import { ForbiddenError, NotFoundError, ValidationError } from "../errors";
import * as reviewsRepo from "./repository";

export type ReviewInput = reviewsRepo.ReviewWrite;

/** Both score axes are 1-10, matching the database check constraints. */
const MIN_SCORE = 1;
const MAX_SCORE = 10;

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

function assertScore(name: string, value: number) {
  if (!Number.isInteger(value) || value < MIN_SCORE || value > MAX_SCORE) {
    throw new ValidationError(
      `${name} must be a whole number between ${MIN_SCORE} and ${MAX_SCORE}`,
    );
  }
}

/**
 * A distribution the reviewer did supply must be complete and add up to 100.
 * `null` is left alone: it is how "I don't remember" is stored, and turning it
 * into zeroes would claim the reviewer answered.
 */
function assertExaminationDistribution(
  distribution: ExaminationDistribution | null,
) {
  if (distribution === null) return;

  let total = 0;
  for (const key of EXAMINATION_DISTRIBUTION_KEYS) {
    const share = distribution[key];
    if (!Number.isInteger(share) || share < 0 || share > 100) {
      throw new ValidationError(
        `Examination distribution "${key}" must be a whole percentage between 0 and 100`,
      );
    }
    total += share;
  }
  if (total !== 100) {
    throw new ValidationError(
      `Examination distribution must add up to 100, got ${total}`,
    );
  }
}

function assertApproachTheoryPercent(percent: number | null) {
  if (percent === null) return;
  if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
    throw new ValidationError(
      "Approach theory percent must be a whole number between 0 and 100",
    );
  }
}

/**
 * Normalizes what the form sends into what the target columns store. An
 * unanswered recollection stays `null`; an empty message becomes `null` rather
 * than an empty string.
 */
function validateReviewInput(input: ReviewInput): ReviewInput {
  assertScore("Workload score", input.workloadScore);
  assertScore("Learning score", input.learningScore);
  assertExaminationDistribution(input.examinationDistribution);
  assertApproachTheoryPercent(input.approachTheoryPercent);

  const message = input.message?.trim();
  return {
    examinationDistribution: input.examinationDistribution,
    approachTheoryPercent: input.approachTheoryPercent,
    workloadScore: input.workloadScore,
    learningScore: input.learningScore,
    happyTook: input.happyTook,
    message: message ? input.message : null,
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
