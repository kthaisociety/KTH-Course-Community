import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { nanoid } from "nanoid"; // for generating unique review ids
import { DRIZZLE } from "src/db/drizzle.module";
import * as schema from "../db/schema";
import { ReviewsGateway } from "./reviews.gateway";

@Injectable()
export class ReviewsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NeonHttpDatabase<typeof schema>,
    private readonly reviewsGateway: ReviewsGateway,
  ) {}

  async create(
    courseCode: string,
    userId: string,
    reviewData: {
      easyScore: number;
      usefulScore: number;
      interestingScore: number;
      wouldRecommend: boolean;
      content: string;
    },
  ) {
    const [inserted] = await this.db
      .insert(schema.reviews)
      .values({
        id: nanoid(), // generate a unique review ID
        userId,
        courseCode,
        easyScore: reviewData.easyScore,
        usefulScore: reviewData.usefulScore,
        interestingScore: reviewData.interestingScore,
        wouldRecommend: reviewData.wouldRecommend,
        content: reviewData.content,
      })
      .returning();
    // Notify clients in the course room
    this.reviewsGateway.emitCourseChanged(courseCode);
    return inserted;
  }

  // either fetch all reviews or all reviews for a specific course
  async findAll(courseCode?: string, userId?: string) {
    const baseQuery = this.db
      .select({
        id: schema.reviews.id,
        userId: schema.reviews.userId,
        courseCode: schema.reviews.courseCode,
        easyScore: schema.reviews.easyScore,
        usefulScore: schema.reviews.usefulScore,
        interestingScore: schema.reviews.interestingScore,
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

    const query = courseCode
      ? baseQuery.where(eq(schema.reviews.courseCode, courseCode))
      : baseQuery;

    return await query;
  }

  // fetch a single review by id
  async findOne(id: string) {
    const [review] = await this.db
      .select()
      .from(schema.reviews)
      .where(eq(schema.reviews.id, id))
      .limit(1);

    if (!review) throw new NotFoundException(`Review with id ${id} not found`);
    return review;
  }

  async update(
    id: string,
    reviewData: {
      easyScore: number;
      usefulScore: number;
      interestingScore: number;
      wouldRecommend: boolean;
      content: string;
    },
  ) {
    const [updated] = await this.db
      .update(schema.reviews)
      .set({
        easyScore: reviewData.easyScore,
        usefulScore: reviewData.usefulScore,
        interestingScore: reviewData.interestingScore,
        wouldRecommend: reviewData.wouldRecommend,
        content: reviewData.content,
        updatedAt: sql`now()`,
      })
      .where(eq(schema.reviews.id, id))
      .returning();

    if (!updated) throw new NotFoundException(`Review with id ${id} not found`);
    this.reviewsGateway.emitCourseChanged(updated.courseCode);
    return updated;
  }

  // delete a review
  async remove(id: string) {
    const [deleted] = await this.db
      .delete(schema.reviews)
      .where(eq(schema.reviews.id, id))
      .returning();

    if (!deleted) throw new NotFoundException(`Review with id ${id} not found`);
    this.reviewsGateway.emitCourseChanged(deleted.courseCode);
    return deleted;
  }

  // toggle like/dislike for a review
  async toggleVote(
    reviewId: string,
    userId: string,
    voteType: "like" | "dislike",
  ) {
    // check if user already voted on this review
    const existingVote = await this.db
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

      // if same vote type, remove the vote
      if (currentVote.voteType === voteType) {
        await this.db
          .delete(schema.reviewLikes)
          .where(
            and(
              eq(schema.reviewLikes.reviewId, reviewId),
              eq(schema.reviewLikes.userId, userId),
            ),
          );
        const review = await this.getReview(reviewId);
        if (review) this.reviewsGateway.emitCourseChanged(review.courseCode);
        return { action: "removed", voteType: null };
      }
      // if different vote type, update to new vote type
      await this.db
        .update(schema.reviewLikes)
        .set({ voteType })
        .where(
          and(
            eq(schema.reviewLikes.reviewId, reviewId),
            eq(schema.reviewLikes.userId, userId),
          ),
        );
      const review = await this.getReview(reviewId);
      if (review) this.reviewsGateway.emitCourseChanged(review.courseCode);
      return { action: "updated", voteType };
    }
    // if no existing vote, create new one
    await this.db.insert(schema.reviewLikes).values({
      userId,
      reviewId,
      voteType,
    });
    const review = await this.getReview(reviewId);
    if (review) this.reviewsGateway.emitCourseChanged(review.courseCode);
    return { action: "added", voteType };
  }

  async removeVote(reviewId: string, userId: string) {
    await this.db
      .delete(schema.reviewLikes)
      .where(
        and(
          eq(schema.reviewLikes.reviewId, reviewId),
          eq(schema.reviewLikes.userId, userId),
        ),
      );
    const review = await this.getReview(reviewId);
    if (review) this.reviewsGateway.emitCourseChanged(review.courseCode);
    return { action: "removed", voteType: null };
  }

  private async getReview(reviewId: string) {
    const [review] = await this.db
      .select({ courseCode: schema.reviews.courseCode })
      .from(schema.reviews)
      .where(eq(schema.reviews.id, reviewId))
      .limit(1);
    return review;
  }
}
