import { randomUUID } from "node:crypto";
import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { DRIZZLE } from "../db/drizzle.module";
import * as schema from "../db/schema";
import {
  SelectReview,
  SelectReviewLike,
  SelectUser,
  SelectUserCourse,
} from "../db/schema";
import type { ParsedCourse } from "./transcript.parser";

// Since we can't change the schema to have the userFAvorites, we need to define a new type,
// that includes the userFavorites property.
type ReviewWithCounts = SelectReview & {
  likeCount: number;
  dislikeCount: number;
};

export type UserWithDetails = SelectUser & {
  userFavorites: string[];
  userReviews: ReviewWithCounts[];
  userLikedReviews: (SelectReviewLike & { review: ReviewWithCounts })[];
  transcriptCourses: SelectUserCourse[];
};

@Injectable()
export class UserService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NeonHttpDatabase<typeof schema>,
  ) {}

  private reviewVoteCount(
    reviewIdColumn: typeof schema.reviews.id,
    voteType: "like" | "dislike",
  ) {
    return sql<number>`(
      SELECT COUNT(*)
      FROM ${schema.reviewLikes}
      WHERE ${schema.reviewLikes.reviewId} = ${reviewIdColumn}
        AND ${schema.reviewLikes.voteType} = ${voteType}
    )`;
  }

  private isMissingUserAuthIdentitiesTableError(error: unknown): boolean {
    if (typeof error !== "object" || error === null) {
      return false;
    }

    const errorRecord = error as { code?: unknown; message?: unknown };
    const message =
      typeof errorRecord.message === "string" ? errorRecord.message : "";

    return (
      errorRecord.code === "42P01" && message.includes("user_auth_identities")
    );
  }

  async resolveAppUserId(authUserId: string): Promise<string | undefined> {
    try {
      const mapping = await this.db
        .select()
        .from(schema.user_auth_identities)
        .where(eq(schema.user_auth_identities.authUserId, authUserId))
        .limit(1);
      if (mapping[0]) {
        return mapping[0].userId;
      }
    } catch (error) {
      // Legacy environments may not have the mapping table yet.
      if (!this.isMissingUserAuthIdentitiesTableError(error)) {
        throw error;
      }
    }

    // Backward compatibility: legacy users used auth ID as app user ID.
    const legacyUser = await this.db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.id, authUserId))
      .limit(1);
    if (legacyUser[0]) {
      return legacyUser[0].id;
    }
    return undefined;
  }

  async createNewUser(id: string, email: string, name: string): Promise<void> {
    try {
      const existingMapping = await this.db
        .select()
        .from(schema.user_auth_identities)
        .where(eq(schema.user_auth_identities.authUserId, id))
        .limit(1);

      if (existingMapping[0]) {
        await this.db
          .update(schema.users)
          .set({ name, email })
          .where(eq(schema.users.id, existingMapping[0].userId));
        return;
      }
    } catch (error) {
      // Legacy environments may not have the mapping table yet.
      if (!this.isMissingUserAuthIdentitiesTableError(error)) {
        throw error;
      }
    }

    const [appUser] = await this.db
      .insert(schema.users)
      .values({
        id: randomUUID(),
        email,
        name,
      })
      .onConflictDoUpdate({
        target: schema.users.email,
        set: { name, email },
      })
      .returning({ id: schema.users.id });

    if (!appUser?.id) {
      throw new InternalServerErrorException(
        "Failed to resolve app user ID during signup.",
      );
    }

    try {
      await this.db
        .insert(schema.user_auth_identities)
        .values({
          authUserId: id,
          userId: appUser.id,
          createdAt: new Date(),
        })
        .onConflictDoNothing({
          target: schema.user_auth_identities.authUserId,
        });
    } catch (error) {
      // Legacy environments may not have the mapping table yet.
      if (!this.isMissingUserAuthIdentitiesTableError(error)) {
        throw error;
      }
    }
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
        examinationMethods: schema.reviews.examinationMethods,
        theoreticalVsApplied: schema.reviews.theoreticalVsApplied,
        workload: schema.reviews.workload,
        learningExperience: schema.reviews.learningExperience,
        wouldRecommend: schema.reviews.wouldRecommend,
        content: schema.reviews.content,
        createdAt: schema.reviews.createdAt,
        updatedAt: schema.reviews.updatedAt,
        likeCount: this.reviewVoteCount(schema.reviews.id, "like"),
        dislikeCount: this.reviewVoteCount(schema.reviews.id, "dislike"),
      })
      .from(schema.reviews)
      .where(eq(schema.reviews.userId, userId));
  }

  async getUserLikedReviews(userId: string) {
    const userLikedReviews = await this.db
      .select({
        userId: schema.reviewLikes.userId,
        reviewId: schema.reviewLikes.reviewId,
        voteType: schema.reviewLikes.voteType,
        createdAt: schema.reviewLikes.createdAt,
        review: {
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
          likeCount: this.reviewVoteCount(schema.reviews.id, "like"),
          dislikeCount: this.reviewVoteCount(schema.reviews.id, "dislike"),
        },
      })
      .from(schema.reviewLikes)
      .innerJoin(
        schema.reviews,
        eq(schema.reviewLikes.reviewId, schema.reviews.id),
      )
      .where(eq(schema.reviewLikes.userId, userId));
    return userLikedReviews;
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
    const [userFavorites, userReviews, userLikedReviews, transcriptCourses] =
      await Promise.all([
        this.getUserFavorites(id),
        this.getUserReviews(id),
        this.getUserLikedReviews(id),
        this.getTranscriptCourses(id),
      ]);
    return {
      ...user,
      userFavorites,
      userReviews,
      userLikedReviews,
      transcriptCourses,
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

  async saveTranscriptCourses(
    userId: string,
    parsed: ParsedCourse[],
  ): Promise<{ imported: string[]; unrecognized: string[] }> {
    if (parsed.length === 0) return { imported: [], unrecognized: [] };

    const codes = parsed.map((c) => c.courseCode);
    const existing = await this.db
      .select({ code: schema.courses.code })
      .from(schema.courses)
      .where(inArray(schema.courses.code, codes));

    const existingSet = new Set(existing.map((c) => c.code));
    const recognized = parsed.filter((c) => existingSet.has(c.courseCode));
    const unrecognized = parsed
      .filter((c) => !existingSet.has(c.courseCode))
      .map((c) => c.courseCode);

    if (recognized.length > 0) {
      await this.db
        .insert(schema.userCourses)
        .values(
          recognized.map((c) => ({
            userId,
            courseCode: c.courseCode,
            grade: c.grade,
            credits: c.credits ?? undefined,
          })),
        )
        .onConflictDoUpdate({
          target: [schema.userCourses.userId, schema.userCourses.courseCode],
          set: {
            grade: sql`excluded.grade`,
            credits: sql`excluded.credits`,
          },
        });
    }

    return { imported: recognized.map((c) => c.courseCode), unrecognized };
  }

  async getTranscriptCourses(userId: string) {
    return this.db
      .select()
      .from(schema.userCourses)
      .where(eq(schema.userCourses.userId, userId));
  }

  async deleteTranscriptCourse(
    userId: string,
    courseCode: string,
  ): Promise<void> {
    await this.db
      .delete(schema.userCourses)
      .where(
        and(
          eq(schema.userCourses.userId, userId),
          eq(schema.userCourses.courseCode, courseCode),
        ),
      );
  }

  async deleteUser(id: string): Promise<void> {
    await this.db
      .delete(schema.user_favorites)
      .where(eq(schema.user_favorites.userId, id));

    await this.db.delete(schema.users).where(eq(schema.users.id, id));
  }
}
