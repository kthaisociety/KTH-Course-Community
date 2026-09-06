/**
 * The `/taken?review=…` contract, and the queue a round starts with.
 *
 * My Page has no reviewer of its own — `/taken` owns the queue — so the only
 * thing it can say about a course the reader picked is what it puts in the URL.
 * The parameter used to be the bare flag `1`, which could say "open the
 * reviewer" and nothing else, so a row and the "Fast track all N" button
 * deep-linked to the very same place and the named course was discarded.
 */

/**
 * `review=1` — the original contract. It still means what it always meant: open
 * the reviewer, on no particular course. Kept so a link somebody bookmarked,
 * or a tab left open across this deploy, still lands where it used to.
 */
export const REVIEW_ALL = "1";

/**
 * A course code as `courses.code` holds one — letters and digits, never
 * punctuation. The parameter is a string off the URL bar, so it is checked
 * rather than trusted; anything else is treated as `1` and the reader gets the
 * whole unreviewed set instead of a queue built around a code that can match no
 * course.
 */
const COURSE_CODE = /^[A-Z0-9]{2,16}$/;

/** What an arrival asked for. `startCode` of `null` is "no particular course". */
export type ReviewDeepLink = { startCode: string | null };

/**
 * What `?review=…` in `search` asks for, or `null` when it asks for nothing.
 *
 * `null` and `{ startCode: null }` are different answers and the caller acts on
 * both: nothing at all leaves the URL alone, while a parameter that named no
 * usable course still opens the reviewer and still has to be taken back out.
 */
export function parseReviewDeepLink(search: string): ReviewDeepLink | null {
  let value: string | null;
  try {
    value = new URLSearchParams(search).get("review");
  } catch {
    return null;
  }
  if (value === null) return null;
  if (value === REVIEW_ALL) return { startCode: null };

  const code = value.trim().toUpperCase();
  return { startCode: COURSE_CODE.test(code) ? code : null };
}

/** The path My Page links to for a whole round, or for one named course. */
export function reviewHref(courseCode?: string): string {
  return courseCode === undefined
    ? `/taken?review=${REVIEW_ALL}`
    : `/taken?review=${encodeURIComponent(courseCode)}`;
}

/**
 * The round's queue: `startCode` first, then the rest of the unreviewed set
 * behind it.
 *
 * A named course is a starting point and not a queue of one — the artboard
 * deals the rest behind it, and someone who came to review one course is
 * exactly who is most likely to review a second.
 *
 * A `startCode` the set does not hold is dropped rather than dealt. It is what
 * a deep link to a course reviewed since, or never taken, arrives as, and
 * putting it at the front would deal a card for a course that has a review
 * already or no row at all.
 */
export function reviewQueue(
  codes: readonly string[],
  startCode: string | null,
): string[] {
  if (startCode === null || !codes.includes(startCode)) return [...codes];
  return [startCode, ...codes.filter((code) => code !== startCode)];
}
