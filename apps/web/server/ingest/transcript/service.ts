import { getSummariesByCodes } from "../../course/service";
import { NotFoundError } from "../../errors";
import { recordEarnedPersonalizationTierOnContribution } from "../../graph/service";
import {
  recordTranscriptConfirmation,
  type TakenCourseInput,
} from "../../taken/service";
import {
  type CatalogueCourse,
  matchCandidates,
  type UnmatchedCandidate,
} from "./match";
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
  /**
   * Rows that could not be tied to exactly one catalogue course — an unknown
   * code, or a name the catalogue does not have or has more than once.
   * Reported, never invented. Most carry no code: Ladok does not print one.
   */
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
 * The catalogue courses the parsed rows could be, looked up in one go.
 *
 * Only the rows that printed a course code can be looked up here: there is no
 * catalogue lookup by name yet, so a row without a code — every row of a real
 * Ladok transcript — finds nothing to match and is reported as unmatched, for
 * the user to add by hand. `matchCandidates` already matches by English and
 * Swedish name; it needs a name lookup feeding this list to use it.
 */
async function catalogueFor(
  candidates: TranscriptCandidate[],
): Promise<CatalogueCourse[]> {
  const codes = candidates.flatMap((candidate) =>
    candidate.courseCode === null ? [] : [candidate.courseCode],
  );
  const summaries = await getSummariesByCodes(codes);
  return summaries.map((summary) => ({
    courseCode: summary.courseCode,
    titleEng: summary.titleEng,
    titleSwe: null,
    credits: summary.credits,
  }));
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
  const catalogue = await catalogueFor(candidates);
  const titles = new Map(
    catalogue.map((course) => [course.courseCode, course.titleEng]),
  );

  const { matched, unmatched } = matchCandidates(candidates, catalogue);

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

function toTakenCourseInput(row: ConfirmedTranscriptRow): TakenCourseInput {
  return {
    courseCode: row.courseCode.trim().toUpperCase(),
    grade: row.grade ?? null,
    earnedCredits: row.earnedCredits ?? null,
    attendanceYear: row.attendanceYear ?? null,
  };
}

/**
 * Writes the courses the user confirmed, and only those.
 *
 * The rows arrive from the browser, so the catalogue check runs again here:
 * `buildTranscriptProposal` filtered the parsed candidates, but nothing stops a
 * client from confirming a code that was never proposed. Only catalogue courses
 * become taken courses.
 *
 * The writes themselves belong to `server/taken`. New rows are inserted only
 * when the user does not already have the course; fills update only fields
 * that are still empty. A manual entry or correction that races this
 * confirmation is therefore never overwritten by transcript values.
 */
export async function confirmTranscriptImport(
  userId: string,
  rows: ConfirmedTranscriptRow[],
  importedAt: Date,
  fills: ConfirmedTranscriptRow[] = [],
): Promise<{ inserted: number; updated: number }> {
  const inputs = rows.map(toTakenCourseInput);
  const fillInputs = fills.map(toTakenCourseInput);
  if (inputs.length === 0 && fillInputs.length === 0) {
    return { inserted: 0, updated: 0 };
  }

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

  const written = await recordTranscriptConfirmation(
    userId,
    inputs,
    fillInputs,
    importedAt,
  );

  // The other moment the personalization ladder can move: an import earns 2, and it
  // earns tier 3 outright for somebody who had already reviewed everything on
  // it. It runs even when nothing was inserted, because a confirmation that
  // only filled fields still tells us the stored rows are worth re-reading, and
  // because the recompute is idempotent. It never lowers the column, so a
  // second import that leaves courses unreviewed cannot take tier 3 away.
  await recordEarnedPersonalizationTierOnContribution(userId);

  return written;
}
