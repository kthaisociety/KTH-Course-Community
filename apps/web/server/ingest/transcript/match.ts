import type { TranscriptCandidate } from "./parse";

/** A candidate whose code the catalogue does not have. Reported, never written. */
export type UnmatchedCandidate = {
  courseCode: string;
  courseName: string;
};

export type TranscriptMatch = {
  /** Candidates that correspond to a course in the catalogue. */
  matched: TranscriptCandidate[];
  /** Candidates that do not. Only catalogue courses can become taken courses. */
  unmatched: UnmatchedCandidate[];
};

function normalise(courseCode: string): string {
  return courseCode.trim().toUpperCase();
}

/**
 * Splits parsed candidates by whether the catalogue knows their course code.
 *
 * Pure: `knownCodes` is whatever the caller looked up, so this stays testable
 * without a database. A course code the catalogue does not have is reported
 * back to the user, never invented as a taken course.
 *
 * A transcript that lists the same code twice yields one row — the first — so
 * that the confirmed proposal never asks the write path to touch one
 * `(user, course)` pair twice.
 */
export function matchCandidates(
  candidates: TranscriptCandidate[],
  knownCodes: Iterable<string>,
): TranscriptMatch {
  const known = new Set([...knownCodes].map(normalise));
  const matched: TranscriptCandidate[] = [];
  const unmatched: UnmatchedCandidate[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const courseCode = normalise(candidate.courseCode);
    if (seen.has(courseCode)) continue;
    seen.add(courseCode);

    if (known.has(courseCode)) matched.push({ ...candidate, courseCode });
    else unmatched.push({ courseCode, courseName: candidate.courseName });
  }

  return { matched, unmatched };
}
