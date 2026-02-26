import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { CourseService } from "src/course/course.service";
import * as schema from "../../../types/database/schema";
import {
  SelectUser,
  SelectUserFavorites,
} from "../../../types/database/schema";
import { DRIZZLE } from "../database/drizzle.module";

// Since we can't change the schema to have the userFAvorites, we need to define a new type,
// that includes the userFavorites property.
export type UserWithFavorites = SelectUser & {
  userFavorites: string[];
};

@Injectable()
export class UserService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NeonHttpDatabase<typeof schema>,
    private readonly courseService: CourseService,
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

  async getUser(id: string): Promise<UserWithFavorites | undefined> {
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

    // User favorites are fetched from a junction table that could probably be removed and re-worked into a new column in user table.
    // Also changed to now only return the course codes instead of an object
    return {
      ...user,
      userFavorites: userFavorites,
    } as UserWithFavorites;
  }

  async toggleUserFavorite(userId: string, courseCode: string) {
    // Check if course code exists, throws error from course.service
    await this.courseService.courseCodeExists(courseCode);

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
