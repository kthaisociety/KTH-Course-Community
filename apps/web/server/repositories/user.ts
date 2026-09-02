import { and, eq } from "drizzle-orm";
import { db } from "../db";
import * as schema from "../db/schema";

type FavoriteRow = typeof schema.user_favorites.$inferSelect;

export async function listFavoriteCodes(userId: string): Promise<string[]> {
  const rows = await db
    .select()
    .from(schema.user_favorites)
    .where(eq(schema.user_favorites.userId, userId));
  return rows.map((f) => f.favoriteCourse);
}

export async function findFavorite(
  userId: string,
  courseCode: string,
): Promise<FavoriteRow | undefined> {
  const [row] = await db
    .select()
    .from(schema.user_favorites)
    .where(
      and(
        eq(schema.user_favorites.userId, userId),
        eq(schema.user_favorites.favoriteCourse, courseCode),
      ),
    )
    .limit(1);
  return row;
}

export async function addFavorite(userId: string, courseCode: string) {
  await db.insert(schema.user_favorites).values({
    userId,
    favoriteCourse: courseCode,
    createdAt: new Date(),
  });
}

export async function removeFavorite(userId: string, courseCode: string) {
  await db
    .delete(schema.user_favorites)
    .where(
      and(
        eq(schema.user_favorites.userId, userId),
        eq(schema.user_favorites.favoriteCourse, courseCode),
      ),
    );
}

export async function updateImage(id: string, imageURL: string) {
  return db
    .update(schema.users)
    .set({ image: imageURL })
    .where(eq(schema.users.id, id));
}

export async function deleteById(id: string) {
  await db.delete(schema.users).where(eq(schema.users.id, id));
}
