/**
 * Effective personalization tier.
 *
 * `users.personalization_tier_earned` stores the highest tier an app user has
 * ever reached. Inactivity decay is derived at read time and is never written
 * back — nothing in this file, or any caller of it, may update that column.
 *
 * The formula lives here, alone and pure, so product can swap it without
 * touching a service or a query.
 */

/** Complete months of inactivity that cost one tier step. */
const MONTHS_PER_DECAY_STEP = 6;

/**
 * Derive the tier an app user effectively has right now.
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
