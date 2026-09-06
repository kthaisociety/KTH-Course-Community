/**
 * `selectUnreviewedCourses` moved to `@/server/reviews/unreviewed` when the
 * personalization tier writer needed the same arithmetic: tier 3 is "every
 * transcript-imported course has a review by you", which is this function
 * narrowed to imported rows. Server code cannot import from `features/`, so the
 * definition had to move to the side both halves can reach, and it is
 * re-exported here so every existing import path keeps working.
 *
 * There is one definition. Do not write a second one — not here, and not in
 * SQL. See the module it came from for why that matters.
 */
export { selectUnreviewedCourses } from "@/server/reviews/unreviewed";

/**
 * Every review across a set of per-course lists, or `null` if any one of them
 * is missing.
 *
 * A list is missing while its request is in flight *and* after that request has
 * failed, and the two are indistinguishable from the data. Both mean the same
 * thing here: we do not know what this course's reviews are. Substituting an
 * empty list would answer "nobody has reviewed it", which is a different claim
 * and the one that puts a review prompt in front of somebody who already wrote
 * theirs.
 *
 * This one stays client-side on purpose: "the request has not answered yet" is
 * a browser cache state and means nothing on the server, which reads the rows
 * or fails.
 */
export function reviewsWhenEveryListLoaded<T>(
  lists: readonly (readonly T[] | undefined)[],
): T[] | null {
  const reviews: T[] = [];
  for (const list of lists) {
    if (list === undefined) return null;
    reviews.push(...list);
  }
  return reviews;
}
