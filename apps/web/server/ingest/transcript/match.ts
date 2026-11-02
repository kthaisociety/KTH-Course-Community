import type { TranscriptCandidate } from "./parse";

/**
 * A catalogue course as the matcher needs it. Either name may be what the
 * transcript printed: Ladok prints the name in the transcript's own language.
 */
export type CatalogueCourse = {
  courseCode: string;
  titleEng: string;
  titleSwe: string | null;
  credits: number | null;
};

/**
 * A candidate the matcher could not tie to exactly one catalogue course.
 * Reported, never written. `courseCode` is set only when the transcript row
 * printed one; most Ladok transcripts do not.
 */
export type UnmatchedCandidate = {
  courseCode: string | null;
  courseName: string;
};

/** A candidate tied to one catalogue course, under that course's code. */
export type MatchedCandidate = TranscriptCandidate & { courseCode: string };

export type TranscriptMatch = {
  /** Candidates that correspond to a course in the catalogue. */
  matched: MatchedCandidate[];
  /** Candidates that do not. Only catalogue courses can become taken courses. */
  unmatched: UnmatchedCandidate[];
};

function normaliseCode(courseCode: string): string {
  return courseCode.trim().toUpperCase();
}

/**
 * The form two course names are compared in: case, whitespace and punctuation
 * do not count, and `&`, `and` and `och` are the same word. A transcript
 * rejoins a wrapped name with single spaces and may print an ampersand the
 * catalogue spells out, and neither should cost a match.
 */
export function normaliseCourseName(name: string): string {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/&/g, " and ")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word !== "")
    .map((word) => (word === "och" ? "and" : word))
    .join(" ");
}

/** Catalogue credits are stored as reals; a transcript prints one decimal. */
function sameCredits(a: number | null, b: number | null): boolean {
  return a !== null && b !== null && Math.abs(a - b) < 0.01;
}

function indexByName(
  catalogue: CatalogueCourse[],
): Map<string, CatalogueCourse[]> {
  const byName = new Map<string, CatalogueCourse[]>();
  for (const course of catalogue) {
    const keys = new Set(
      [course.titleEng, course.titleSwe]
        .filter((title): title is string => !!title)
        .map(normaliseCourseName),
    );
    for (const key of keys) {
      if (key === "") continue;
      const bucket = byName.get(key) ?? [];
      if (!bucket.some((known) => known.courseCode === course.courseCode)) {
        bucket.push(course);
      }
      byName.set(key, bucket);
    }
  }
  return byName;
}

/**
 * The one catalogue course a name can mean, or `null`.
 *
 * Several courses can share a name — "Programming" is more than one course —
 * so a shared name is settled by credits when exactly one of them has the
 * credits the transcript printed. Anything still ambiguous is not guessed at:
 * a wrong course on someone's record is worse than asking them to add it.
 */
function resolveByName(
  candidate: TranscriptCandidate,
  byName: Map<string, CatalogueCourse[]>,
): string | null {
  const courses = byName.get(normaliseCourseName(candidate.courseName)) ?? [];
  if (courses.length === 1) return courses[0].courseCode;
  const byCredits = courses.filter((course) =>
    sameCredits(course.credits, candidate.credits),
  );
  return byCredits.length === 1 ? byCredits[0].courseCode : null;
}

/**
 * Splits parsed candidates by whether they correspond to exactly one
 * catalogue course.
 *
 * A row that printed a course code is matched by that code. A row without one
 * — every row of a real Ladok transcript — is matched by its name against the
 * catalogue's English and Swedish names, with credits as the tiebreak. Whatever
 * cannot be tied to one course is reported back to the user, never invented as
 * a taken course.
 *
 * Pure: `catalogue` is whatever the caller looked up, so this stays testable
 * without a database.
 *
 * Two rows that resolve to the same course yield one row — the first — so
 * that the confirmed proposal never asks the write path to touch one
 * `(user, course)` pair twice. Unmatched rows are deduplicated the same way, by
 * code when they have one and by name when they do not.
 */
export function matchCandidates(
  candidates: TranscriptCandidate[],
  catalogue: CatalogueCourse[],
): TranscriptMatch {
  const knownCodes = new Set(
    catalogue.map((course) => normaliseCode(course.courseCode)),
  );
  const byName = indexByName(catalogue);
  const matched: MatchedCandidate[] = [];
  const unmatched: UnmatchedCandidate[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const printedCode =
      candidate.courseCode === null
        ? null
        : normaliseCode(candidate.courseCode);
    const resolved =
      printedCode === null
        ? resolveByName(candidate, byName)
        : knownCodes.has(printedCode)
          ? printedCode
          : null;

    if (resolved !== null) {
      if (seen.has(resolved)) continue;
      seen.add(resolved);
      matched.push({ ...candidate, courseCode: resolved });
      continue;
    }

    const key =
      printedCode ?? `name:${normaliseCourseName(candidate.courseName)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unmatched.push({
      courseCode: printedCode,
      courseName: candidate.courseName,
    });
  }

  return { matched, unmatched };
}
