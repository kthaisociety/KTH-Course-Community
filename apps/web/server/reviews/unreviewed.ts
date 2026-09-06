import type { Review } from "@/types";

/**
 * What "unreviewed" means, for everybody who asks.
 *
 * This is the one definition in the repo and it is deliberately pure: no
 * database, no tRPC, no React. It sits in the reviews domain because "reviewed
 * by you" is a reviews concept, and it sits in `server/` because that is the
 * half of the codebase the other half can reach — Biome forbids server code
 * importing from `features/`, so a shared derivation cannot live there.
 * `features/reviews/lib/unreviewed.ts` re-exports it, which is why Taken
 * courses and My Page keep importing exactly what they always did.
 *
 * Both callers are worth naming, because they are why a second copy is
 * dangerous. The client counts what is left to review — the "Fast track all N"
 * figure. The server asks the same question of transcript-imported courses to
 * decide personalization tier 3 (`server/graph/tier.ts`). If those two ever
 * disagreed, a member would be told they had finished while the tier said they
 * had not. One function is how that stays impossible.
 */

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
