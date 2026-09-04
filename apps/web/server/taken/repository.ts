import { and, count, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import * as schema from "../db/schema";

export type TakenCourseRecord = typeof schema.userTakenCourses.$inferSelect;

/** The self-reported fields of one taken course. Always fully specified. */
export type TakenCourseWrite = {
  courseCode: string;
  grade: string | null;
  earnedCredits: number | null;
  attendancePeriods: string | null;
  attendanceYear: number | null;
};

/**
 * What a write does to `transcript_imported_at`.
 *
 * `set` stamps the column. `preserve` leaves it null on insert and leaves an
 * existing value alone on update, so a manual edit to an imported row keeps its
 * provenance.
 */
export type TranscriptProvenance =
  | { mode: "set"; importedAt: Date }
  | { mode: "preserve" };

export function listTakenCourses(userId: string): Promise<TakenCourseRecord[]> {
  return db
    .select()
    .from(schema.userTakenCourses)
    .where(eq(schema.userTakenCourses.userId, userId))
    .orderBy(schema.userTakenCourses.courseCode);
}

/** Of `courseCodes`, the ones this user already has a taken row for. */
export async function findTakenCourseCodes(
  userId: string,
  courseCodes: string[],
): Promise<string[]> {
  if (courseCodes.length === 0) return [];
  const rows = await db
    .select({ courseCode: schema.userTakenCourses.courseCode })
    .from(schema.userTakenCourses)
    .where(
      and(
        eq(schema.userTakenCourses.userId, userId),
        inArray(schema.userTakenCourses.courseCode, courseCodes),
      ),
    );
  return rows.map((row) => row.courseCode);
}

/**
 * Upserts taken rows on the `(user_id, course_code)` primary key.
 *
 * `rows` must already be free of duplicate course codes: PostgreSQL cannot
 * apply `ON CONFLICT` to the same row twice in one statement.
 */
export async function upsertTakenCourses(
  userId: string,
  rows: TakenCourseWrite[],
  provenance: TranscriptProvenance,
): Promise<void> {
  if (rows.length === 0) return;
  const transcriptImportedAt =
    provenance.mode === "set" ? provenance.importedAt : null;
  await db
    .insert(schema.userTakenCourses)
    .values(rows.map((row) => ({ userId, ...row, transcriptImportedAt })))
    .onConflictDoUpdate({
      target: [
        schema.userTakenCourses.userId,
        schema.userTakenCourses.courseCode,
      ],
      set: {
        grade: sql`excluded.grade`,
        earnedCredits: sql`excluded.earned_credits`,
        attendancePeriods: sql`excluded.attendance_periods`,
        attendanceYear: sql`excluded.attendance_year`,
        updatedAt: new Date(),
        // Absent under "preserve": omitting the column from the SET list is
        // what keeps an already imported row's provenance.
        ...(provenance.mode === "set"
          ? { transcriptImportedAt: provenance.importedAt }
          : {}),
      },
    });
}

/**
 * Inserts transcript rows without replacing a row that another client already
 * recorded. The primary-key conflict decision happens in PostgreSQL with the
 * insert, so a manual write that lands between a browser's list refresh and
 * transcript confirmation is preserved.
 *
 * Returns the codes that this statement actually inserted. `ON CONFLICT DO
 * NOTHING` also handles a course duplicated within one transcript batch.
 */
export async function insertTakenCoursesIfAbsent(
  userId: string,
  rows: TakenCourseWrite[],
  importedAt: Date,
): Promise<string[]> {
  if (rows.length === 0) return [];
  const inserted = await db
    .insert(schema.userTakenCourses)
    .values(
      rows.map((row) => ({
        userId,
        ...row,
        transcriptImportedAt: importedAt,
      })),
    )
    .onConflictDoNothing({
      target: [
        schema.userTakenCourses.userId,
        schema.userTakenCourses.courseCode,
      ],
    })
    .returning({ courseCode: schema.userTakenCourses.courseCode });
  return inserted.map((row) => row.courseCode);
}

/** Fills only fields that are still null, preserving concurrent edits. */
export async function fillTakenCourseFieldsIfEmpty(
  userId: string,
  row: TakenCourseWrite,
): Promise<boolean> {
  const updated = await db
    .update(schema.userTakenCourses)
    .set({
      grade: sql`coalesce(${schema.userTakenCourses.grade}, ${row.grade})`,
      earnedCredits: sql`coalesce(${schema.userTakenCourses.earnedCredits}, ${row.earnedCredits})`,
      attendanceYear: sql`coalesce(${schema.userTakenCourses.attendanceYear}, ${row.attendanceYear})`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.userTakenCourses.userId, userId),
        eq(schema.userTakenCourses.courseCode, row.courseCode),
      ),
    )
    .returning({ courseCode: schema.userTakenCourses.courseCode });
  return updated.length > 0;
}

/**
 * Edits an existing row and nothing else. One statement, so a concurrent
 * delete cannot slip between a check and the write and be undone by it —
 * unlike `upsertTakenCourses`, this never inserts.
 *
 * `transcript_imported_at` is not in the SET list, so an imported row keeps its
 * provenance through a manual edit.
 *
 * Returns whether a row was actually updated.
 */
export async function updateTakenCourse(
  userId: string,
  row: TakenCourseWrite,
): Promise<boolean> {
  const updated = await db
    .update(schema.userTakenCourses)
    .set({
      grade: row.grade,
      earnedCredits: row.earnedCredits,
      attendancePeriods: row.attendancePeriods,
      attendanceYear: row.attendanceYear,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.userTakenCourses.userId, userId),
        eq(schema.userTakenCourses.courseCode, row.courseCode),
      ),
    )
    .returning({ courseCode: schema.userTakenCourses.courseCode });
  return updated.length > 0;
}

export type TakenCountRow = {
  courseCode: string;
  takenCount: number;
};

/**
 * How many app users have recorded taking each course, in one grouped query
 * for a whole page of course cards rather than one per card. A course nobody
 * has recorded is missing rather than zero-valued; the caller supplies the
 * zero, because here row existence *is* the count.
 */
export async function countByCourseCodes(
  courseCodes: string[],
): Promise<TakenCountRow[]> {
  if (courseCodes.length === 0) return [];

  const rows = await db
    .select({
      courseCode: schema.userTakenCourses.courseCode,
      takenCount: count(),
    })
    .from(schema.userTakenCourses)
    .where(inArray(schema.userTakenCourses.courseCode, courseCodes))
    .groupBy(schema.userTakenCourses.courseCode);

  // `count()` arrives from the driver as a bigint string.
  return rows.map((row) => ({
    courseCode: row.courseCode,
    takenCount: Number(row.takenCount),
  }));
}

/** Returns whether a row was actually deleted. */
export async function deleteTakenCourse(
  userId: string,
  courseCode: string,
): Promise<boolean> {
  const deleted = await db
    .delete(schema.userTakenCourses)
    .where(
      and(
        eq(schema.userTakenCourses.userId, userId),
        eq(schema.userTakenCourses.courseCode, courseCode),
      ),
    )
    .returning({ courseCode: schema.userTakenCourses.courseCode });
  return deleted.length > 0;
}
