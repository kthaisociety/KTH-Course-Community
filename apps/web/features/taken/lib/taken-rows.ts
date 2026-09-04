import type { TranscriptProposal } from "@/server/ingest/transcript/service";
import type { RouterOutputs } from "@/trpc/client";

/**
 * One taken course as `taken.list` returns it: a course code and the facts the
 * student reported about their own attendance. Nothing on it is a review.
 */
export type TakenCourse = RouterOutputs["taken"]["list"][number];

/**
 * A taken course joined with the catalogue's name for it.
 *
 * `user_taken_courses` stores only `course_code`, so the title is looked up per
 * screen and falls back to the code when the lookup has not answered — the same
 * fallback `UnreviewedCard` makes.
 */
export type TakenRow = TakenCourse & { name: string };

/** One course a parsed transcript is offering. Nothing has been written yet. */
export type ProposalRow = TranscriptProposal["candidates"][number];

/** Exactly the input `taken.update` takes. */
export type TakenUpdateInput = {
  courseCode: string;
  grade: string | null;
  earnedCredits: number | null;
  attendancePeriods: string | null;
  attendanceYear: number | null;
};

/** The three self-reported fields the list lets a reader correct in place. */
export type TakenEdits = {
  grade: string | null;
  earnedCredits: number | null;
  attendanceYear: number | null;
};

export function toTakenRows(
  courses: readonly TakenCourse[],
  names: ReadonlyMap<string, string>,
): TakenRow[] {
  return courses.map((course) => ({
    ...course,
    name: names.get(course.courseCode) ?? course.courseCode,
  }));
}

/**
 * When this list was last filled in from a transcript, or null if none of it
 * was. `transcript_imported_at` is the only thing that distinguishes an
 * imported row from a hand-entered one, and a manual edit keeps it.
 */
export function lastTranscriptImport(
  courses: readonly TakenCourse[],
): string | null {
  let latest: string | null = null;
  for (const course of courses) {
    const at = course.transcriptImportedAt;
    if (at && (latest === null || at > latest)) latest = at;
  }
  return latest;
}

/**
 * The whole row `taken.update` writes.
 *
 * `taken.update` replaces every self-reported field — its router says outright
 * that omitting one "is the same as clearing it" — while the list only ever
 * edits three. `attendancePeriods` is carried through from the stored row so
 * that correcting a grade cannot silently erase a period, which the design's
 * table has no column for and so could never show the reader losing.
 */
export function takenUpdateInput(
  row: TakenCourse,
  edits: TakenEdits,
): TakenUpdateInput {
  return {
    courseCode: row.courseCode,
    grade: edits.grade,
    earnedCredits: edits.earnedCredits,
    attendanceYear: edits.attendanceYear,
    attendancePeriods: row.attendancePeriods,
  };
}

/**
 * What the reader confirmed, in the shape `transcript.confirm` takes.
 *
 * `includeGrades` is the design's "Read grades from transcript" switch. It is
 * applied here, on the way into the write, because that is the only place it
 * can bite: the parse happens on the server and always reads the grade column,
 * so the switch drops grades from what gets stored rather than from what gets
 * read. Nothing is written either way until this result is sent.
 *
 * `attendancePeriods` is absent by construction — a Ladok transcript has no
 * period column and `ConfirmedTranscriptRow` omits the field for that reason.
 */
export function toConfirmedCourses(
  rows: readonly ProposalRow[],
  includeGrades: boolean,
): Array<{
  courseCode: string;
  grade: string | null;
  earnedCredits: number | null;
  attendanceYear: number | null;
}> {
  return rows.map((row) => ({
    courseCode: row.courseCode,
    grade: includeGrades ? row.grade : null,
    earnedCredits: row.earnedCredits,
    attendanceYear: row.attendanceYear,
  }));
}

/** `null` when the box is empty; `undefined` when what is in it is not credits. */
export function parseCredits(text: string): number | null | undefined {
  const trimmed = text.trim().replace(",", ".");
  if (trimmed === "") return null;
  const credits = Number(trimmed);
  if (!Number.isFinite(credits) || credits < 0 || credits > 1000) {
    return undefined;
  }
  return credits;
}

/**
 * `null` when the box is empty; `undefined` when what is in it is not a year.
 *
 * The bounds are `taken.update`'s own — a year outside them is refused by the
 * procedure, so the editor refuses to send it rather than showing a failure.
 */
export function parseYear(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  if (!/^\d{4}$/.test(trimmed)) return undefined;
  const year = Number(trimmed);
  return year >= 1900 && year <= 2200 ? year : undefined;
}

/** `null` when the box is empty. A grade is self-reported and never validated. */
export function parseGrade(text: string): string | null {
  const trimmed = text.trim().toUpperCase();
  return trimmed === "" ? null : trimmed.slice(0, 16);
}

/** The edits an inline draft describes, or null while one of its boxes is unreadable. */
export function draftEdits(draft: {
  grade: string;
  credits: string;
  year: string;
}): TakenEdits | null {
  const earnedCredits = parseCredits(draft.credits);
  const attendanceYear = parseYear(draft.year);
  if (earnedCredits === undefined || attendanceYear === undefined) return null;
  return { grade: parseGrade(draft.grade), earnedCredits, attendanceYear };
}

/** `7.5 hp`, or an em dash where the student reported no credits. */
export function creditsLabel(credits: number | null): string {
  return credits === null ? "—" : `${credits} hp`;
}
