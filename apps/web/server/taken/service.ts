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

/** Edits the self-reported fields of a course the user already has. */
export async function updateTakenCourse(
  userId: string,
  input: TakenCourseInput,
): Promise<{ courseCode: string }> {
  await assertTaken(userId, input.courseCode);
  await recordTakenCourses(userId, [input], { source: "manual" });
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

async function assertTaken(userId: string, courseCode: string): Promise<void> {
  const existing = await takenRepo.findTakenCourseCodes(userId, [courseCode]);
  if (existing.length === 0) throw notTaken(courseCode);
}

function notTaken(courseCode: string): NotFoundError {
  return new NotFoundError(`You have not recorded ${courseCode} as taken`);
}
