import { and, eq } from "drizzle-orm";
import type { Database } from "./db";
import * as schema from "./db/schema";

export type Me = {
  userId: string;
  name: string;
  email: string;
  userFavorites: string[];
  image: string | null;
};

export async function getUserFavorites(
  db: Database,
  id: string,
): Promise<string[]> {
  const userFavorites = await db
    .select()
    .from(schema.user_favorites)
    .where(eq(schema.user_favorites.userId, id));
  return userFavorites.map((f) => f.favoriteCourse);
}

export async function toggleUserFavorite(
  db: Database,
  userId: string,
  courseCode: string,
) {
  const courseInFavorites = await db
    .select()
    .from(schema.user_favorites)
    .where(
      and(
        eq(schema.user_favorites.userId, userId),
        eq(schema.user_favorites.favoriteCourse, courseCode),
      ),
    )
    .limit(1);

  if (courseInFavorites.length > 0) {
    await db
      .delete(schema.user_favorites)
      .where(
        and(
          eq(schema.user_favorites.userId, userId),
          eq(schema.user_favorites.favoriteCourse, courseCode),
        ),
      );
    return { action: "removed" as const };
  }
  await db.insert(schema.user_favorites).values({
    userId,
    favoriteCourse: courseCode,
    createdAt: new Date(),
  });
  return { action: "added" as const };
}

export async function updateImage(db: Database, id: string, imageURL: string) {
  return await db
    .update(schema.users)
    .set({ image: imageURL })
    .where(eq(schema.users.id, id));
}

export async function deleteUser(db: Database, id: string): Promise<void> {
  await db.delete(schema.users).where(eq(schema.users.id, id));
}
