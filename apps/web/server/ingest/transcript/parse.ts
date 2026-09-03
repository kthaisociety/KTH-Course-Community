/**
 * Pure parser for the text layer of a Ladok transcript ("Resultatintyg" /
 * "Official Transcript of Records"). Extracting that text from a PDF is
 * `pdf-text.ts`; this module never sees the file.
 */

/**
 * Raised when the text does not look like a Ladok transcript.
 *
 * Its message is a fixed string: an academic record must never reach a log line
 * or an API response by way of an error.
 */
export class TranscriptParseError extends Error {
  readonly code = "TRANSCRIPT_UNREADABLE" as const;
  constructor(message: string) {
    super(message);
    this.name = "TranscriptParseError";
  }
}

/** One completed-course row as the transcript printed it. Self-reported data. */
export type TranscriptCandidate = {
  courseCode: string;
  courseName: string;
  credits: number | null;
  grade: string | null;
  /** The result date Ladok printed, as `YYYY-MM-DD`. */
  completedOn: string | null;
};

/** Start of the completed-courses table, in either transcript language. */
const TABLE_HEADER = /^(?:Code|Kod)\s+(?:Name|Benämning)\b/;

/** First line after the table; Ladok always prints a summation block. */
const TABLE_END = /^(?:Summation|Summering)\b/;

/** A KTH course code: two or three letters then four digits. */
const COURSE_CODE = /^[A-ZÅÄÖ]{2,3}\d{4}[A-Z]?$/;

/** The longest course name KTH prints is well under this. */
const MAX_NAME_LENGTH = 300;

/**
 * A real transcript's text layer is tens of kilobytes. The bound is not a
 * judgement about the document: it stops a crafted PDF from handing the regexes
 * below a megabyte-long line to backtrack over.
 */
const MAX_TEXT_LENGTH = 500_000;

/**
 * A wrapped course name runs to a second or third line, and its remaining
 * columns may land on one more. Past that, the lines belong to something else.
 */
const MAX_CONTINUATION_LINES = 4;

/**
 * `<code> <name> <credits> hp <grade> <YYYY-MM-DD> [note]`, matched against a
 * whole row after its wrapped lines have been rejoined. The name is length-
 * bounded so a failed match cannot backtrack across a long line.
 */
const ROW = new RegExp(
  `^([A-ZÅÄÖ]{2,3}\\d{4}[A-Z]?)\\s+(.{1,${MAX_NAME_LENGTH}}?)\\s+(\\d+(?:[.,]\\d+)?)\\s*hp\\s+(\\S{1,3})\\s+(\\d{4}-\\d{2}-\\d{2})(?:\\s+\\d+)?$`,
);

/** The fallback when a row's trailing columns are unreadable: code and name. */
const ROW_HEAD = /^([A-ZÅÄÖ]{2,3}\d{4}[A-Z]?)\s+(.*)$/;

function toLines(text: string): string[] {
  return text.split(/\r\n|\r|\n/).map((line) => line.trim());
}

function startsRow(line: string): boolean {
  return COURSE_CODE.test(line.split(/\s+/)[0] ?? "");
}

/**
 * Splits the table body into one string per course, rejoining the lines a long
 * course name wrapped onto.
 *
 * A row keeps absorbing following lines only until it has all of its columns.
 * That is what carries the table over a page break: once a row is complete, the
 * page footer and the repeated column header that follow it belong to no row
 * and are dropped instead of being glued onto the last course name.
 */
function rowBlocks(lines: string[]): string[] {
  const blocks: string[] = [];
  let continuations = 0;
  for (const line of lines) {
    if (line === "") continue;
    if (startsRow(line)) {
      blocks.push(line);
      continuations = 0;
      continue;
    }
    const open = blocks.at(-1);
    if (open === undefined) continue;
    if (continuations >= MAX_CONTINUATION_LINES || ROW.test(open)) continue;
    blocks[blocks.length - 1] = `${open} ${line}`;
    continuations += 1;
  }
  return blocks;
}

export function parseLadokTranscript(text: string): TranscriptCandidate[] {
  if (text.length > MAX_TEXT_LENGTH) {
    throw new TranscriptParseError(
      "This document is too large to be a Ladok transcript.",
    );
  }

  const lines = toLines(text);
  const headerAt = lines.findIndex((line) => TABLE_HEADER.test(line));
  if (headerAt === -1) {
    throw new TranscriptParseError(
      "This file does not look like a Ladok transcript. Export your " +
        "transcript from Ladok as a PDF and upload that file.",
    );
  }
  const rest = lines.slice(headerAt + 1);
  const endAt = rest.findIndex((line) => TABLE_END.test(line));
  const body = endAt === -1 ? rest : rest.slice(0, endAt);

  const candidates: TranscriptCandidate[] = [];
  for (const block of rowBlocks(body)) {
    const match = ROW.exec(block);
    if (match) {
      const [, courseCode, courseName, credits, grade, completedOn] = match;
      candidates.push({
        courseCode,
        courseName,
        credits: Number(credits.replace(",", ".")),
        grade,
        completedOn,
      });
      continue;
    }

    // A row whose trailing columns did not survive the PDF's text layer still
    // has to reach the user: dropping it would silently lose a taken course.
    const head = ROW_HEAD.exec(block);
    if (!head) continue;
    candidates.push({
      courseCode: head[1],
      courseName: head[2].trim().slice(0, MAX_NAME_LENGTH),
      credits: null,
      grade: null,
      completedOn: null,
    });
  }

  if (candidates.length === 0) {
    throw new TranscriptParseError(
      "No completed courses were found in this transcript.",
    );
  }
  return candidates;
}
