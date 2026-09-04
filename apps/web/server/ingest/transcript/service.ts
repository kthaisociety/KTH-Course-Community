import { getSummariesByCodes } from "../../course/service";
import { NotFoundError } from "../../errors";
import {
  fillTranscriptCourseFields,
  recordTranscriptCoursesIfAbsent,
  type TakenCourseInput,
} from "../../taken/service";
import { matchCandidates, type UnmatchedCandidate } from "./match";
import { parseLadokTranscript, type TranscriptCandidate } from "./parse";

/**
 * One course the user is being offered for import. Grade and credits come off
 * the transcript but stay self-reported: the file is not authoritative and the
 * user may change them before confirming.
 */
export type TranscriptProposalRow = {
  courseCode: string;
  /** The course name as the transcript printed it, in its own language. */
  transcriptName: string;
  /** The catalogue's name for the same course, so the user can tell them apart. */
  catalogueName: string;
  grade: string | null;
  earnedCredits: number | null;
  attendanceYear: number | null;
};

/** What a parsed transcript offers. Nothing here has been written. */
export type TranscriptProposal = {
  candidates: TranscriptProposalRow[];
  /** Course codes with no catalogue entry. Reported, never invented. */
  unmatched: UnmatchedCandidate[];
};

/**
 * Ladok prints the date a result was reported, not the term the course ran.
 * Its year is the closest thing the transcript has to when the course was
 * taken, and the user can correct it — `attendance_year` is self-reported.
 */
function attendanceYearOf(candidate: TranscriptCandidate): number | null {
  if (!candidate.completedOn) return null;
  const year = Number(candidate.completedOn.slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

/**
 * Turns the text of a Ladok transcript into a proposal for the user to confirm.
 *
 * Reads only; the transcript is never stored and never logged. Throws
 * `TranscriptParseError` when the text is not a readable transcript.
 */
export async function buildTranscriptProposal(
  text: string,
): Promise<TranscriptProposal> {
  const candidates = parseLadokTranscript(text);
  const summaries = await getSummariesByCodes(
    candidates.map((candidate) => candidate.courseCode),
  );
  const titles = new Map(
    summaries.map((summary) => [summary.courseCode, summary.titleEng]),
  );

  const { matched, unmatched } = matchCandidates(candidates, titles.keys());

  return {
    candidates: matched.map((candidate) => ({
      courseCode: candidate.courseCode,
      transcriptName: candidate.courseName,
      catalogueName: titles.get(candidate.courseCode) ?? candidate.courseName,
      grade: candidate.grade,
      earnedCredits: candidate.credits,
      attendanceYear: attendanceYearOf(candidate),
    })),
    unmatched,
  };
}

/**
 * A row the user accepted, possibly after editing what the transcript said.
 *
 * Derived from #64's pinned `TakenCourseInput` rather than restated, so that a
 * change to the write contract fails the typecheck here instead of drifting.
 * `attendancePeriods` is dropped: a Ladok transcript has no period column, and
 * an import must not pretend to know one.
 */
export type ConfirmedTranscriptRow = Omit<
  TakenCourseInput,
  "attendancePeriods"
>;

/**
 * Writes the courses the user confirmed, and only those.
 *
 * The rows arrive from the browser, so the catalogue check runs again here:
 * `buildTranscriptProposal` filtered the parsed candidates, but nothing stops a
 * client from confirming a code that was never proposed. Only catalogue courses
 * become taken courses.
 *
 * The write itself belongs to `server/taken`. It inserts only when the user
 * does not already have a row for the course, so a manual entry that races this
 * confirmation is never overwritten by transcript values.
 */
export async function confirmTranscriptImport(
  userId: string,
  rows: ConfirmedTranscriptRow[],
  importedAt: Date,
  fills: ConfirmedTranscriptRow[] = [],
): Promise<{ inserted: number; updated: number }> {
  const inputs: TakenCourseInput[] = rows.map((row) => ({
    courseCode: row.courseCode.trim().toUpperCase(),
    grade: row.grade ?? null,
    earnedCredits: row.earnedCredits ?? null,
    attendanceYear: row.attendanceYear ?? null,
  }));
  if (inputs.length === 0) return { inserted: 0, updated: 0 };

  const fillInputs: TakenCourseInput[] = fills.map((row) => ({
    courseCode: row.courseCode.trim().toUpperCase(),
    grade: row.grade ?? null,
    earnedCredits: row.earnedCredits ?? null,
    attendanceYear: row.attendanceYear ?? null,
  }));
  const codes = [...inputs, ...fillInputs].map((input) => input.courseCode);
  const known = new Set(
    (await getSummariesByCodes(codes)).map((summary) => summary.courseCode),
  );
  const missing = [...new Set(codes.filter((code) => !known.has(code)))];
  if (missing.length > 0) {
    throw new NotFoundError(
      `No course in the catalogue matches ${missing.join(", ")}.`,
    );
  }

  const created = await recordTranscriptCoursesIfAbsent(
    userId,
    inputs,
    importedAt,
  );
  return {
    inserted: created.inserted,
    updated:
      fillInputs.length > 0
        ? await fillTranscriptCourseFields(userId, fillInputs)
        : 0,
  };
}
