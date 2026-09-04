import { and, eq } from "drizzle-orm";
import { db } from "../db";
import * as schema from "../db/schema";

export type SavedCourseRecord = typeof schema.userSavedCourses.$inferSelect;

export async function listSavedCourseCodes(userId: string): Promise<string[]> {
  const rows = await db
    .select({ courseCode: schema.userSavedCourses.courseCode })
    .from(schema.userSavedCourses)
    .where(eq(schema.userSavedCourses.userId, userId))
    .orderBy(schema.userSavedCourses.createdAt);
  return rows.map((row) => row.courseCode);
}

export async function findSavedCourse(
  userId: string,
  courseCode: string,
): Promise<SavedCourseRecord | undefined> {
  const [row] = await db
    .select()
    .from(schema.userSavedCourses)
    .where(
      and(
        eq(schema.userSavedCourses.userId, userId),
        eq(schema.userSavedCourses.courseCode, courseCode),
      ),
    )
    .limit(1);
  return row;
}

/** Idempotent: saving an already saved course keeps the original row. */
export async function insertSavedCourse(
  userId: string,
  courseCode: string,
): Promise<void> {
  await db
    .insert(schema.userSavedCourses)
    .values({ userId, courseCode })
    .onConflictDoNothing();
}

/**
 * Removes the save only. Taken history and reviews have no foreign key to this
 * table and are untouched; `collection_courses` rows for the pair go with it,
 * because a collection may only hold courses their owner has saved.
 */
export async function deleteSavedCourse(
  userId: string,
  courseCode: string,
): Promise<void> {
  await db
    .delete(schema.userSavedCourses)
    .where(
      and(
        eq(schema.userSavedCourses.userId, userId),
        eq(schema.userSavedCourses.courseCode, courseCode),
      ),
    );
}
