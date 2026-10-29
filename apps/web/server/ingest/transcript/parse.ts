/**
 * Pure parser for the text layer of a Ladok transcript ("Resultatintyg" /
 * "Official Transcript of Records"). Extracting that text from a PDF is
 * `pdf-text.ts`; this module never sees the file.
 *
 * The layout it reads is the one Ladok actually prints, checked against real
 * `unpdf` output rather than written from memory: a `Name Scope Grade Date
 * Note` table with **no course-code column**. Each row is a course name —
 * wrapped onto as many lines as it needs — followed by `<credits> hp <grade>
 * <date> [note]` at the end of its last line. An earlier version of this parser
 * expected a leading code on every row, matched hand-written fixtures, and
 * rejected every real transcript. A leading code is still accepted, in case
 * some export prints one, but nothing depends on it.
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
  /**
   * Ladok's transcript does not print course codes, so this is usually `null`
   * and the course is found by its name instead (`match.ts`). It is set only
   * when the row itself began with a KTH course code.
   */
  courseCode: string | null;
  courseName: string;
  credits: number | null;
  grade: string | null;
  /** The result date Ladok printed, as `YYYY-MM-DD`. */
  completedOn: string | null;
};

/**
 * Start of the completed-courses table, in either transcript language. The
 * grade and date columns are required: a certificate of registration prints a
 * table that starts the same way but has a `Period` column instead, and must
 * not pass for a list of results.
 *
 * The Swedish column names are the Ladok vocabulary, not yet checked against a
 * real Swedish export the way the English ones were.
 */
const TABLE_HEADER =
  /^(?:(?:Code|Kod)\s+)?(?:Name|Benämning)\s+(?:Scope|Omfattning)\s+(?:Grade|Betyg)\s+(?:Date|Datum)\b/;

/** First line after the table; Ladok always prints a summation block. */
const TABLE_END = /^(?:Summation|Summering)\b/;

/**
 * The registration certificate's title and its table header. Ladok offers this
 * document next to the transcript, students pick it by mistake, and it lists
 * courses that are only registered — including ones that have not started.
 */
const REGISTRATION_TITLE =
  /\b(?:Registreringsintyg|Certificate of Registration)\b/;
const REGISTRATION_HEADER =
  /^(?:(?:Code|Kod)\s+)?(?:Name|Benämning)\s+(?:Scope|Omfattning)\s+Period\b/;

/**
 * A KTH course code: two or three letters followed by either four digits and
 * an optional suffix, or three digits and the degree-project suffix `X`.
 */
const COURSE_CODE = /^[A-ZÅÄÖ]{2,3}(?:\d{4}[A-Z]?|\d{3}X)$/;

/** The longest course name KTH prints is well under this. */
const MAX_NAME_LENGTH = 300;

/**
 * No line of a real row is longer than a full-length name plus its columns. A
 * longer one is not part of the table, and is never handed to the tail pattern.
 */
const MAX_LINE_LENGTH = MAX_NAME_LENGTH + 64;

/**
 * A real transcript's text layer is tens of kilobytes. The bound is not a
 * judgement about the document: it stops a crafted PDF from handing the regexes
 * below a megabyte-long input to work through.
 */
const MAX_TEXT_LENGTH = 500_000;

/**
 * A wrapped course name runs to a second or third line before the line that
 * carries its remaining columns. Past this many, the lines belong to something
 * else and are dropped rather than joined into one enormous name.
 */
const MAX_NAME_LINES = 4;

/**
 * The columns that end a row: `<credits> (hp|fup) <grade> <YYYY-MM-DD>
 * [note]`, at the end of a line. Every quantifier is bounded and the pattern is
 * anchored at the end, so a failed match cannot backtrack across a long line.
 *
 * `fup` is the unit Ladok prints for the preparatory year (förutbildnings-
 * poäng). Those rows are read so that they close their block, then skipped:
 * they are not KTH catalogue courses.
 */
const ROW_TAIL =
  /(?:^|\s)(\d{1,3}(?:[.,]\d{1,2})?)\s*(hp|fup)\s+(\S{1,3})\s+(\d{4}-\d{2}-\d{2})(?:\s+\d{1,2})?$/;

/**
 * Marks a line as belonging to the page rather than to the table: the Ladok
 * verification footer, the page counter, the address block, and the header
 * Ladok repeats at the top of each page — the student's name beside the
 * document title, their personal identity number beside the print date, and
 * the column header.
 *
 * These lines are stepped over rather than joined, so a course name really does
 * survive a page break — while the footer and header, which carry the student's
 * name and personal identity number, never land inside a course name. Any line
 * holding something shaped like a personal identity number is furniture for the
 * same reason, whatever else it says.
 */
const PAGE_FURNITURE = [
  TABLE_HEADER,
  /student\.ladok\.se/i,
  /\b(?:Page|Sida)\s+\d+\s*\/\s*\d+/,
  /^(?:Verifiable until|Verifierbart tom)\b/,
  /^(?:Postal address|Postadress)\b/,
  /^(?:Contact information|Kontaktinformation)\b/,
  /(?:Personal identity number|Personnummer)\b/,
  /(?:Control code|Kontrollkod)\s*:/,
  /\b(?:Official Transcript of Records|Resultatintyg)\b/,
  /\b\d{6}(?:\d{2})?[-+]\d{4}\b/,
  /^https?:\/\//i,
  /^(?:KTH Royal Institute of Technology|Kungliga Tekniska högskolan)\b/,
  // The postal-address line, e.g. "100 44 Stockholm".
  /^\d{3}\s?\d{2}\s+\S/,
];

function isPageFurniture(line: string): boolean {
  return PAGE_FURNITURE.some((pattern) => pattern.test(line));
}

function toLines(text: string): string[] {
  return text.split(/\r\n|\r|\n/).map((line) => line.trim());
}

function leadingCode(line: string): string | null {
  const first = line.split(/\s+/, 1)[0] ?? "";
  return COURSE_CODE.test(first) ? first : null;
}

/** The lines collected for a row whose trailing columns have not come yet. */
type OpenRow = { lines: string[]; code: string | null };

/**
 * A row that began with a course code but whose trailing columns never came.
 * It still reaches the user: the code alone identifies the course, and
 * dropping it would silently lose a taken course. Without a code there is
 * nothing to identify such a row by, so a bare name is dropped.
 */
function unfinished(open: OpenRow): TranscriptCandidate | null {
  if (open.code === null) return null;
  const name = open.lines.join(" ").slice(open.code.length).trim();
  return {
    courseCode: open.code,
    courseName: name.slice(0, MAX_NAME_LENGTH),
    credits: null,
    grade: null,
    completedOn: null,
  };
}

/**
 * Reads the table body into rows.
 *
 * Lines accumulate until one ends with the row's trailing columns; that line
 * closes the row and everything collected is its name. Page furniture is
 * stepped over without being collected, which is what carries a row over a
 * page break intact: the name on one page and the columns on the next are
 * rejoined, while the footer and header between them are never part of a name.
 *
 * A line that begins with a course code starts a new row, so a coded row whose
 * columns did not survive the text layer is reported on its own rather than
 * swallowed by the row after it.
 */
function readRows(body: string[]): TranscriptCandidate[] {
  const rows: TranscriptCandidate[] = [];
  let open: OpenRow = { lines: [], code: null };

  const abandon = () => {
    const row = unfinished(open);
    if (row) rows.push(row);
    open = { lines: [], code: null };
  };

  for (const line of body) {
    if (line === "" || isPageFurniture(line)) continue;
    if (line.length > MAX_LINE_LENGTH) {
      abandon();
      continue;
    }

    const code = leadingCode(line);
    if (code !== null && open.lines.length > 0) abandon();
    if (open.lines.length === 0) open.code = code;

    const tail = ROW_TAIL.exec(line);
    if (!tail) {
      open.lines.push(line);
      if (open.lines.length > MAX_NAME_LINES) abandon();
      continue;
    }

    const [, credits, unit, grade, completedOn] = tail;
    const rowCode = open.code;
    open.lines.push(line.slice(0, tail.index));
    const joined = open.lines.join(" ").replace(/\s+/g, " ").trim();
    const name =
      rowCode === null ? joined : joined.slice(rowCode.length).trim();
    open = { lines: [], code: null };

    if (unit === "fup") continue;
    if (name === "" || name.length > MAX_NAME_LENGTH) {
      const row = unfinished({ lines: [joined], code: rowCode });
      if (row) rows.push(row);
      continue;
    }
    rows.push({
      courseCode: rowCode,
      courseName: name,
      credits: Number(credits.replace(",", ".")),
      grade,
      completedOn,
    });
  }
  abandon();
  return rows;
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
    const isRegistration = lines.some(
      (line) => REGISTRATION_TITLE.test(line) || REGISTRATION_HEADER.test(line),
    );
    if (isRegistration) {
      throw new TranscriptParseError(
        "This is a certificate of registration (Registreringsintyg), which " +
          "lists the courses you are registered on rather than the ones you " +
          "have completed. In Ladok, download a Resultatintyg (Transcript of " +
          "Records) instead.",
      );
    }
    throw new TranscriptParseError(
      "This file does not look like a Ladok transcript. In Ladok, download " +
        "a Resultatintyg (Transcript of Records) as a PDF and upload that file.",
    );
  }
  const rest = lines.slice(headerAt + 1);
  const endAt = rest.findIndex((line) => TABLE_END.test(line));
  const body = endAt === -1 ? rest : rest.slice(0, endAt);

  const candidates = readRows(body);
  if (candidates.length === 0) {
    throw new TranscriptParseError(
      "No completed courses were found in this transcript.",
    );
  }
  return candidates;
}
