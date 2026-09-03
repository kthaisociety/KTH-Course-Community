import { getSummariesByCodes } from "../../course/service";
import { NotFoundError } from "../../errors";
import { recordTakenCourses, type TakenCourseInput } from "../../taken/service";
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

/** A row the user accepted, possibly after editing what the transcript said. */
export type ConfirmedTranscriptRow = {
  courseCode: string;
  grade?: string | null;
  earnedCredits?: number | null;
  attendanceYear?: number | null;
};

/**
 * Writes the courses the user confirmed, and only those.
 *
 * The rows arrive from the browser, so the catalogue check runs again here:
 * `buildTranscriptProposal` filtered the parsed candidates, but nothing stops a
 * client from confirming a code that was never proposed. Only catalogue courses
 * become taken courses.
 *
 * The write itself belongs to `server/taken` (#64). Its upsert is what makes a
 * second import of the same transcript update rather than duplicate; this
 * function's part is to send each course code exactly once.
 */
export async function confirmTranscriptImport(
  userId: string,
  rows: ConfirmedTranscriptRow[],
  importedAt: Date,
): Promise<{ inserted: number; updated: number }> {
  const byCode = new Map<string, ConfirmedTranscriptRow>();
  for (const row of rows) {
    const courseCode = row.courseCode.trim().toUpperCase();
    if (!byCode.has(courseCode)) byCode.set(courseCode, { ...row, courseCode });
  }
  if (byCode.size === 0) return { inserted: 0, updated: 0 };

  const codes = [...byCode.keys()];
  const known = new Set(
    (await getSummariesByCodes(codes)).map((summary) => summary.courseCode),
  );
  const missing = codes.filter((code) => !known.has(code));
  if (missing.length > 0) {
    throw new NotFoundError(
      `No course in the catalogue matches ${missing.join(", ")}.`,
    );
  }

  const inputs: TakenCourseInput[] = [...byCode.values()].map((row) => ({
    courseCode: row.courseCode,
    grade: row.grade ?? null,
    earnedCredits: row.earnedCredits ?? null,
    attendanceYear: row.attendanceYear ?? null,
  }));

  return recordTakenCourses(userId, inputs, {
    source: "transcript",
    importedAt,
  });
}
