import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { DRIZZLE } from "../db/drizzle.module";
import * as schema from "../db/schema";
import { SelectUser } from "../db/schema";

// Since we can't change the schema to have the userFAvorites, we need to define a new type,
// that includes the userFavorites property.
export type UserWithFavorites = SelectUser & {
  userFavorites: string[];
};

@Injectable()
export class UserService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NeonHttpDatabase<typeof schema>,
  ) {}

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
    } catch {
      // Mapping table may not exist yet in legacy environments.
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
    } catch {
      // Mapping table may not exist yet in legacy environments.
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
    } catch {
      // Mapping table may not exist yet in legacy environments.
    }
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
