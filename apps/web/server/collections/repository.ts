import { and, eq, max, sql } from "drizzle-orm";
import { db } from "../db";
import * as schema from "../db/schema";

export type CollectionRecord = typeof schema.collections.$inferSelect;

export type CollectionCourseRow = {
  collectionId: string;
  courseCode: string;
  position: number;
};

export function listCollections(userId: string): Promise<CollectionRecord[]> {
  return db
    .select()
    .from(schema.collections)
    .where(eq(schema.collections.userId, userId))
    .orderBy(schema.collections.createdAt);
}

/** Every membership row of every collection this user owns. */
export function listCollectionCoursesForUser(
  userId: string,
): Promise<CollectionCourseRow[]> {
  return db
    .select({
      collectionId: schema.collectionCourses.collectionId,
      courseCode: schema.collectionCourses.courseCode,
      position: schema.collectionCourses.position,
    })
    .from(schema.collectionCourses)
    .where(eq(schema.collectionCourses.collectionUserId, userId));
}

/** Scoped by owner: another user's collection reads as absent. */
export async function findCollection(
  userId: string,
  collectionId: string,
): Promise<CollectionRecord | undefined> {
  const [row] = await db
    .select()
    .from(schema.collections)
    .where(
      and(
        eq(schema.collections.id, collectionId),
        eq(schema.collections.userId, userId),
      ),
    )
    .limit(1);
  return row;
}

export async function insertCollection(values: {
  id: string;
  userId: string;
  name: string;
}): Promise<CollectionRecord> {
  const [row] = await db.insert(schema.collections).values(values).returning();
  return row;
}

export async function updateCollectionName(
  userId: string,
  collectionId: string,
  name: string,
): Promise<CollectionRecord | undefined> {
  const [row] = await db
    .update(schema.collections)
    .set({ name })
    .where(
      and(
        eq(schema.collections.id, collectionId),
        eq(schema.collections.userId, userId),
      ),
    )
    .returning();
  return row;
}

export async function deleteCollection(
  userId: string,
  collectionId: string,
): Promise<void> {
  await db
    .delete(schema.collections)
    .where(
      and(
        eq(schema.collections.id, collectionId),
        eq(schema.collections.userId, userId),
      ),
    );
}

/**
 * The collection's course codes, in stored order. `course_code` breaks a tie:
 * nothing stops two rows sharing a position, and a read must still be stable.
 */
export async function listCourseCodes(collectionId: string): Promise<string[]> {
  const rows = await db
    .select({ courseCode: schema.collectionCourses.courseCode })
    .from(schema.collectionCourses)
    .where(eq(schema.collectionCourses.collectionId, collectionId))
    .orderBy(
      schema.collectionCourses.position,
      schema.collectionCourses.courseCode,
    );
  return rows.map((row) => row.courseCode);
}

/**
 * Appends a course at the end of the collection and reports whether a row was
 * added — `false` means it was already a member and kept its position.
 *
 * Reading the last position and inserting after it is one transaction that
 * locks the parent collection row first, so two concurrent additions to the
 * same collection are serialized and cannot both claim the same position.
 *
 * `collectionUserId` is repeated so PostgreSQL can check both composite keys —
 * collection ownership, and that the same user has saved the course.
 */
export function appendCollectionCourse(values: {
  collectionId: string;
  collectionUserId: string;
  courseCode: string;
}): Promise<boolean> {
  return db.transaction(async (tx) => {
    await tx
      .select({ id: schema.collections.id })
      .from(schema.collections)
      .where(
        and(
          eq(schema.collections.id, values.collectionId),
          eq(schema.collections.userId, values.collectionUserId),
        ),
      )
      .for("update");

    const [last] = await tx
      .select({ value: max(schema.collectionCourses.position) })
      .from(schema.collectionCourses)
      .where(eq(schema.collectionCourses.collectionId, values.collectionId));

    const inserted = await tx
      .insert(schema.collectionCourses)
      .values({ ...values, position: (last?.value ?? -1) + 1 })
      .onConflictDoNothing()
      .returning({ courseCode: schema.collectionCourses.courseCode });

    return inserted.length > 0;
  });
}

/** Returns whether a membership row was actually deleted. */
export async function deleteCollectionCourse(
  collectionId: string,
  courseCode: string,
): Promise<boolean> {
  const deleted = await db
    .delete(schema.collectionCourses)
    .where(
      and(
        eq(schema.collectionCourses.collectionId, collectionId),
        eq(schema.collectionCourses.courseCode, courseCode),
      ),
    )
    .returning({ courseCode: schema.collectionCourses.courseCode });
  return deleted.length > 0;
}

/**
 * Rewrites every position in one statement so no intermediate state is
 * visible. `orderedCourseCodes` must be exactly the collection's members.
 */
export async function setCoursePositions(
  collectionId: string,
  orderedCourseCodes: string[],
): Promise<void> {
  if (orderedCourseCodes.length === 0) return;
  const cases = sql.join(
    orderedCourseCodes.map(
      (courseCode, position) =>
        sql`when ${schema.collectionCourses.courseCode} = ${courseCode} then ${position}`,
    ),
    sql` `,
  );
  await db
    .update(schema.collectionCourses)
    .set({
      position: sql`case ${cases} else ${schema.collectionCourses.position} end`,
    })
    .where(eq(schema.collectionCourses.collectionId, collectionId));
}
