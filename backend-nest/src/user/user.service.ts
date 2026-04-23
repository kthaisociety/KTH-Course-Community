import { Inject, Injectable } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { DRIZZLE } from "../db/drizzle.module";
import * as schema from "../db/schema";
import { SelectReview, SelectUser } from "../db/schema";

// Since we can't change the schema to have the userFAvorites, we need to define a new type,
// that includes the userFavorites property.
export type UserWithDetails = SelectUser & {
  userFavorites: string[];
  userReviews: SelectReview[];
};

@Injectable()
export class UserService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NeonHttpDatabase<typeof schema>,
  ) {}

  async createNewUser(id: string, email: string, name: string): Promise<void> {
    const existingById = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);

    if (existingById[0]) return; // user already exists in database
    // TODO: Might want to return that feedback to the system.

    await this.db
      .insert(schema.users)
      .values({
        id,
        email,
        name,
      })
      .onConflictDoNothing({ target: schema.users.email });
  }

  async getUserFavorites(userId: string): Promise<string[]> {
    const userFavorites = await this.db
      .select()
      .from(schema.user_favorites)
      .where(eq(schema.user_favorites.userId, userId));
    return userFavorites.map((f) => f.favoriteCourse); // returns just the course codes
  }

  async getUserReviews(userId: string) {
    return await this.db
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
        dislikeCount: sql<number>`COALESCE(dislike_counts.dislike_count, 0)`,
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
        sql`(
          SELECT review_id, COUNT(*) as dislike_count
          FROM ${schema.reviewLikes}
          WHERE vote_type = 'dislike'
          GROUP BY review_id
        ) as dislike_counts`,
        eq(schema.reviews.id, sql`dislike_counts.review_id`),
      )
      .where(eq(schema.reviews.userId, userId));
  }

  async getUser(id: string): Promise<UserWithDetails | undefined> {
    const users = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);
    const user = users[0];

    if (!user) {
      return undefined;
    }
    const userFavorites = await this.getUserFavorites(id);
    const userReviews = await this.getUserReviews(id);
    // User favorites are fetched from a junction table that could probably be removed and re-worked into a new column in user table.
    // Also changed to now only return the course codes instead of an object
    return {
      ...user,
      userFavorites: userFavorites,
      userReviews: userReviews,
    } as UserWithDetails;
  }

  async toggleUserFavorite(userId: string, courseCode: string) {
    const courseInFavorites = await this.db
      .select()
      .from(schema.user_favorites)
      .where(
        and(
          eq(schema.user_favorites.userId, userId),
          eq(schema.user_favorites.favoriteCourse, courseCode),
        ),
      )
      .limit(1);

    // if course in favorites, remove the course
    if (courseInFavorites.length > 0) {
      await this.db
        .delete(schema.user_favorites)
        .where(
          and(
            eq(schema.user_favorites.userId, userId),
            eq(schema.user_favorites.favoriteCourse, courseCode),
          ),
        );
      return { action: "removed" };
    }
    await this.db
      .insert(schema.user_favorites) //NOTE: This needs to be update to have the user table instead of junction after update
      .values({
        userId: userId,
        favoriteCourse: courseCode,
        createdAt: new Date(),
      });
    return { action: "added" };
  }

  async updateProfilePicture(userId: string, profilePictureUrl: string) {
    return await this.db
      .update(schema.users)
      .set({ profilePicture: profilePictureUrl })
      .where(eq(schema.users.id, userId));
  }

  async deleteUser(id: string): Promise<void> {
    await this.db
      .delete(schema.user_favorites)
      .where(eq(schema.user_favorites.userId, id));

    await this.db.delete(schema.users).where(eq(schema.users.id, id));
  }
}
