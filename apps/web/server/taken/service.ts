import { NotFoundError } from "../errors";
import * as takenRepo from "./repository";

/**
 * A taken course as the API returns it. Dates are ISO strings because the tRPC
 * link carries no transformer.
 */
export type TakenCourse = {
  courseCode: string;
  grade: string | null;
  earnedCredits: number | null;
  attendancePeriods: string | null;
  attendanceYear: number | null;
  transcriptImportedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * One taken course as a caller supplies it. Every self-reported field is
 * optional; an omitted field is stored as null, never as 0 or "".
 */
export type TakenCourseInput = {
  courseCode: string;
  grade?: string | null;
  earnedCredits?: number | null;
  attendancePeriods?: string | null;
  attendanceYear?: number | null;
};

/** Where a taken-course write came from. */
export type TakenCourseWriteSource =
  | { source: "manual" }
  | { source: "transcript"; importedAt: Date };

function serializeTakenCourse(row: takenRepo.TakenCourseRecord): TakenCourse {
  return {
    courseCode: row.courseCode,
    grade: row.grade,
    earnedCredits: row.earnedCredits,
    attendancePeriods: row.attendancePeriods,
    attendanceYear: row.attendanceYear,
    transcriptImportedAt: row.transcriptImportedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toWrite(input: TakenCourseInput): takenRepo.TakenCourseWrite {
  return {
    courseCode: input.courseCode,
    grade: input.grade ?? null,
    earnedCredits: input.earnedCredits ?? null,
    attendancePeriods: input.attendancePeriods ?? null,
    attendanceYear: input.attendanceYear ?? null,
  };
}

/** Collapses repeats of a course code within one batch; the last row wins. */
function dedupeByCourseCode(rows: TakenCourseInput[]): TakenCourseInput[] {
  const byCode = new Map<string, TakenCourseInput>();
  for (const row of rows) byCode.set(row.courseCode, row);
  return [...byCode.values()];
}

export async function listTakenCourses(userId: string): Promise<TakenCourse[]> {
  const rows = await takenRepo.listTakenCourses(userId);
  return rows.map(serializeTakenCourse);
}

/**
 * Upserts taken courses for one app user.
 *
 * Idempotent on (userId, courseCode): a second call for the same pair updates
 * the existing row and never inserts a duplicate.
 *
 * `source: "transcript"` sets `transcript_imported_at` to `importedAt`.
 * `source: "manual"` leaves it null on insert and MUST NOT clear an existing
 * value on update — a manual edit to an imported row keeps its provenance.
 *
 * The returned counts are read before the write, so two writers racing on the
 * same pair may both report an insert. The rows themselves stay correct.
 */
export async function recordTakenCourses(
  userId: string,
  rows: TakenCourseInput[],
  source: TakenCourseWriteSource,
): Promise<{ inserted: number; updated: number }> {
  const deduped = dedupeByCourseCode(rows);
  if (deduped.length === 0) return { inserted: 0, updated: 0 };

  const existing = new Set(
    await takenRepo.findTakenCourseCodes(
      userId,
      deduped.map((row) => row.courseCode),
    ),
  );

  await takenRepo.upsertTakenCourses(
    userId,
    deduped.map(toWrite),
    source.source === "transcript"
      ? { mode: "set", importedAt: source.importedAt }
      : { mode: "preserve" },
  );

  const updated = deduped.filter((row) => existing.has(row.courseCode)).length;
  return { inserted: deduped.length - updated, updated };
}

/**
 * Records transcript rows only when no taken-course row exists yet.
 *
 * Unlike the manual upsert path, transcript confirmation must never overwrite
 * a course the reader added or corrected in another session. The repository
 * makes that decision atomically with `ON CONFLICT DO NOTHING`.
 */
export async function recordTranscriptCoursesIfAbsent(
  userId: string,
  rows: TakenCourseInput[],
  importedAt: Date,
): Promise<{ inserted: number; updated: number }> {
  const inserted = await takenRepo.insertTakenCoursesIfAbsent(
    userId,
    dedupeByCourseCode(rows).map(toWrite),
    importedAt,
  );
  return { inserted: inserted.length, updated: 0 };
}

/** Atomically fills transcript facts only where the stored row is still empty. */
export async function fillTranscriptCourseFields(
  userId: string,
  rows: TakenCourseInput[],
): Promise<number> {
  let updated = 0;
  for (const row of dedupeByCourseCode(rows)) {
    if (await takenRepo.fillTakenCourseFieldsIfEmpty(userId, toWrite(row))) {
      updated += 1;
    }
  }
  return updated;
}

/** Records one course the user says they took. Idempotent. */
export async function addTakenCourse(
  userId: string,
  input: TakenCourseInput,
): Promise<{ courseCode: string; created: boolean }> {
  const { inserted } = await recordTakenCourses(userId, [input], {
    source: "manual",
  });
  return { courseCode: input.courseCode, created: inserted > 0 };
}

/**
 * Edits the self-reported fields of a course the user already has.
 *
 * This is update-only, not an upsert: it goes through a single `UPDATE` so a
 * concurrent `removeTakenCourse` cannot be silently undone by an edit that was
 * in flight when the row was deleted.
 */
export async function updateTakenCourse(
  userId: string,
  input: TakenCourseInput,
): Promise<{ courseCode: string }> {
  const updated = await takenRepo.updateTakenCourse(userId, toWrite(input));
  if (!updated) throw notTaken(input.courseCode);
  return { courseCode: input.courseCode };
}

export async function removeTakenCourse(
  userId: string,
  courseCode: string,
): Promise<{ courseCode: string }> {
  const deleted = await takenRepo.deleteTakenCourse(userId, courseCode);
  if (!deleted) throw notTaken(courseCode);
  return { courseCode };
}

function notTaken(courseCode: string): NotFoundError {
  return new NotFoundError(`You have not recorded ${courseCode} as taken`);
}

export type TakenCount = takenRepo.TakenCountRow;

/**
 * How many app users have recorded taking each of these courses. Courses
 * nobody has recorded are absent from the result; the course card's zero is
 * supplied by whoever renders it.
 *
 * This is a count over the whole table rather than one user's rows, which is
 * why it takes no `userId`: it is the "how many have taken it" figure on a
 * course card, not a person's own history.
 */
export function getTakenCountsByCourseCodes(
  courseCodes: string[],
): Promise<TakenCount[]> {
  return takenRepo.countByCourseCodes(courseCodes);
}
