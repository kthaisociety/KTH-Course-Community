import { nanoid } from "nanoid";
import type { Review } from "@/types";
import { ForbiddenError, NotFoundError } from "../errors";
import * as reviewsRepo from "../repositories/reviews";

export type ReviewInput = reviewsRepo.ReviewWrite;

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function serializeReview(
  row: reviewsRepo.ReviewRecord & {
    likeCount?: number | string | null;
    userVote?: string | null;
  },
): Review {
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
  courseCode: string,
  userId: string,
  reviewData: ReviewInput,
) {
  const inserted = await reviewsRepo.insertReview({
    id: nanoid(),
    userId,
    courseCode,
    ...reviewData,
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
  const updated = await reviewsRepo.updateById(id, reviewData);
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
  userId: string,
  voteType: "like" | "dislike",
) {
  const existingVote = await reviewsRepo.findVote(reviewId, userId);

  if (existingVote) {
    if (existingVote.voteType === voteType) {
      await reviewsRepo.deleteVote(reviewId, userId);
      return { action: "removed" as const, voteType: null };
    }
    await reviewsRepo.updateVote(reviewId, userId, voteType);
    return { action: "updated" as const, voteType };
  }

  await reviewsRepo.insertVote(reviewId, userId, voteType);
  return { action: "added" as const, voteType };
}

async function assertAuthor(reviewId: string, userId: string) {
  const review = await findOneReview(reviewId);
  if (review.userId !== userId) {
    throw new ForbiddenError("You can only change your own review");
  }
}
