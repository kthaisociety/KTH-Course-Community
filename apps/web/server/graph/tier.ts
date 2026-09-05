import type { Review } from "@/types";
import { selectUnreviewedCourses } from "../reviews/unreviewed";

/**
 * Personalization tier: what earns it, and what inactivity does to it.
 *
 * `users.personalization_tier_earned` stores the highest tier an app user has
 * ever reached. `deriveEarnedTier` says what that number should be from the
 * app user's contributions; `deriveEffectiveTier` derives the decayed tier at
 * read time and is never written back.
 *
 * Both formulas live here, alone and pure, so product can swap them without
 * touching a service or a query. They are one policy seen from two ends —
 * earning and decay — which is why they share a file rather than a layer.
 *
 * The rule itself is #161's settled ladder, and the two halves are deliberately
 * asymmetric: see `deriveEarnedTier` on why a non-monotonic condition still
 * produces a column that only ever rises.
 */

/** Complete months of inactivity that cost one tier step. */
const MONTHS_PER_DECAY_STEP = 6;

/** The highest tier the ladder defines. Matches the column's check constraint. */
export const MAX_PERSONALIZATION_TIER = 3;

/**
 * Everything the ladder is decided from, and nothing else.
 *
 * `transcriptImportedCourses` is already narrowed to rows whose
 * `transcript_imported_at` is set. Manual entries are excluded by the caller
 * rather than filtered here, because "which rows count as imported" is a
 * question about the `user_taken_courses` column and belongs with whoever
 * reads it; what belongs here is what the ladder does with them.
 */
export type EarnedTierInputs = {
  /** The app user whose ladder this is. */
  userId: string;
  /** Reviews visible to the caller. Only this app user's own are counted. */
  reviews: readonly Pick<Review, "courseCode" | "userId">[];
  /** This app user's taken courses that came from a transcript import. */
  transcriptImportedCourses: readonly { courseCode: string }[];
};

/**
 * The tier an app user's contributions have earned, right now.
 *
 * The ladder, settled in #161:
 *
 * - **1** — they have published a review. The 0→1 step, and the contribution
 *   the product most wants.
 * - **2** — they have imported a transcript: at least one `user_taken_courses`
 *   row with `transcript_imported_at` set. Manual entry does not earn this;
 *   the tier rewards the upload specifically, because that is the data the
 *   column can vouch for.
 * - **3** — every transcript-imported course has a review by them, and there
 *   is at least one imported course, so an empty import cannot make "all
 *   reviewed" vacuously true.
 *
 * Each rung is tested on its own and the highest one that holds wins, rather
 * than every lower rung having to hold as well. That matters in one case only:
 * somebody who imports a transcript before writing anything is at 2, not 0.
 * Reading it the other way would make the plain statement "tier 2 is an
 * imported transcript" false, and there is nothing to gain by holding a
 * member's own history against them.
 *
 * **This result may go down. The stored column may not.** Tier 3's condition is
 * not monotonic: importing a second transcript later leaves imported courses
 * unreviewed again and this function will answer 2 where it once answered 3.
 * The earned tier still stands — `CONTEXT.md` defines it as "the highest value
 * ever reached" under **Personalization tier**. The asymmetry is the design,
 * not a bug to be tidied away: the writer in `graph/service.ts` raises the
 * column and never lowers it, and decay is a separate, read-time thing that
 * `deriveEffectiveTier` computes and nobody stores.
 */
export function deriveEarnedTier(inputs: EarnedTierInputs): number {
  // No viewer, no ladder. Said out loud because `selectUnreviewedCourses`
  // answers "nothing is unreviewed" for an empty id, which would otherwise
  // read as a completed transcript and hand out tier 3.
  if (!inputs.userId) return 0;

  const hasImported = inputs.transcriptImportedCourses.length > 0;
  // The one definition of "unreviewed", narrowed to imported courses. Tier 3
  // falls out of the same arithmetic the "Fast track all N" count uses; a
  // second version of it written in SQL is exactly the duplication #161 forbids.
  const unreviewedImported = selectUnreviewedCourses(
    inputs.transcriptImportedCourses,
    inputs.reviews,
    inputs.userId,
  );
  if (hasImported && unreviewedImported.length === 0) return 3;
  if (hasImported) return 2;

  const hasPublishedReview = inputs.reviews.some(
    (review) => review.userId === inputs.userId,
  );
  return hasPublishedReview ? 1 : 0;
}

/**
 * Derive the tier an app user effectively has right now.
 *
 * Decay is read-time and disposable: this result is never stored, and no caller
 * of it may update `personalization_tier_earned`. The only write to that column
 * is `raiseEarnedPersonalizationTier`, which raises it from `deriveEarnedTier`
 * and never lowers it.
 *
 * @param earnedTier The highest tier ever reached (`users.personalization_tier_earned`).
 * @param lastReviewAt The date decay is measured from: the app user's most
 *   recent qualifying review, or — when they have never reviewed — their
 *   `users.created_at`, so a brand-new account is not instantly decayed and an
 *   account that never reviewed decays from when it joined. `null` means no
 *   reference date is known at all and yields no decay.
 * @param now The instant to evaluate against.
 * @returns The effective tier, clamped to `[0, earnedTier]`.
 */
export function deriveEffectiveTier(
  earnedTier: number,
  lastReviewAt: Date | null,
  now: Date,
): number {
  if (lastReviewAt === null) return earnedTier;

  const steps = Math.floor(
    completeMonthsBetween(lastReviewAt, now) / MONTHS_PER_DECAY_STEP,
  );
  return clamp(earnedTier - steps, 0, earnedTier);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Whole calendar months from `from` to `to`, in UTC. A month is complete only
 * once its day-of-month anniversary is reached, so 31 Jan → 30 Jul is five
 * months and 31 Jan → 31 Jul is six.
 */
function completeMonthsBetween(from: Date, to: Date): number {
  if (to.getTime() <= from.getTime()) return 0;

  const calendarMonths =
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (to.getUTCMonth() - from.getUTCMonth());
  const anniversary = addUTCMonths(from, calendarMonths);
  return anniversary.getTime() > to.getTime()
    ? calendarMonths - 1
    : calendarMonths;
}

/** `from` shifted by whole months, clamping to the last day of a short month. */
function addUTCMonths(from: Date, months: number): Date {
  const dayOfMonth = from.getUTCDate();
  const shifted = new Date(from.getTime());
  shifted.setUTCDate(1);
  shifted.setUTCMonth(shifted.getUTCMonth() + months);
  const daysInTargetMonth = new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 0),
  ).getUTCDate();
  shifted.setUTCDate(Math.min(dayOfMonth, daysInTargetMonth));
  return shifted;
}
