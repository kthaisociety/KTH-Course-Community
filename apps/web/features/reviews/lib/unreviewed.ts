import type { Review } from "@/types";

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

/**
 * The taken courses this viewer has not reviewed yet.
 *
 * The set arithmetic lives here rather than inside `UnreviewedCard` so the card
 * renders whatever list it is handed and knows nothing about how that list was
 * derived — and so Taken courses and My Page derive it the same way instead of
 * each writing their own filter.
 *
 * `reviews` is every review the caller loaded for the courses in `taken`, not
 * only the viewer's: `reviews.list` takes a course code and has no author
 * filter, so the personal half of the question is answered here. Another
 * student's review of a course leaves that course unreviewed *by you*.
 *
 * Note what is deliberately absent: nothing here reads a satisfaction state.
 * `happyTook` belongs to a published review and does not exist until one is
 * written, so a course in this list has no verdict to render.
 */
export function selectUnreviewedCourses<T extends { courseCode: string }>(
  taken: readonly T[],
  reviews: readonly Pick<Review, "courseCode" | "userId">[],
  viewerUserId: string,
): T[] {
  // With nobody signed in there is no author to compare against, and treating
  // every taken course as unreviewed would prompt the wrong person.
  if (!viewerUserId) return [];

  const reviewedCourseCodes = new Set(
    reviews
      .filter((review) => review.userId === viewerUserId)
      .map((review) => review.courseCode),
  );

  return taken.filter((course) => !reviewedCourseCodes.has(course.courseCode));
}
