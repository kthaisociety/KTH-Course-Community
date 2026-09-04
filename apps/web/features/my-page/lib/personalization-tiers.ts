/**
 * The personalization tiers My Page's "My dot" tab lists, and which of them the
 * viewer has reached.
 *
 * Two rules govern everything here, both from `CONTEXT.md` and #93.
 *
 * **The tier shown is the effective one.** `users.personalization_tier_earned`
 * holds the highest tier ever reached and is never lowered;
 * `graph.effectiveTier` derives what inactivity has left of it. This file takes
 * the effective number and says nothing at all about the earned one — a row
 * that read "you lost this" would assert something the database never records.
 *
 * **A locked row says only that it is locked.** The artboard has a third
 * "Dormant" badge for a tier that was earned and has since decayed. Telling
 * dormant from locked needs the earned tier beside the effective one, and
 * `graph.effectiveTier` returns a single number, so the two collapse into
 * "Locked" here rather than one of them being guessed.
 */

/**
 * The three appearance axes, in the order the artboard lists them. The index in
 * this array plus one is the tier that unlocks the axis.
 *
 * `unlockHint` is the artboard's own copy for how a tier is reached. Nothing in
 * `server/` writes `personalization_tier_earned` yet, so every account is at
 * tier 0 and all three read as locked — the hints describe the intended rules,
 * not a mechanism that runs today.
 */
export const PERSONALIZATION_AXES = [
  {
    key: "color",
    title: "Dot color",
    unlockHint: "Unlocks once you have written 5 reviews.",
  },
  {
    key: "style",
    title: "Dot style",
    unlockHint: "Unlocks once your uploaded transcript is fully reviewed.",
  },
  {
    key: "signalStyle",
    title: "Signal on click",
    unlockHint: "Unlocks once you have referred friends to Course Community.",
  },
] as const;

export type PersonalizationAxisKey =
  (typeof PERSONALIZATION_AXES)[number]["key"];

export type PersonalizationTierRow = {
  key: PersonalizationAxisKey;
  /** The tier that unlocks this axis: 1, 2 or 3. */
  tier: number;
  title: string;
  unlockHint: string;
  unlocked: boolean;
};

/**
 * The three rows, marked against an effective tier.
 *
 * `effectiveTier` is clamped rather than trusted: the column allows 0-3 today,
 * and a build that meets a wider value should still render three sensible rows
 * instead of throwing on somebody's own page.
 */
export function personalizationTierRows(
  effectiveTier: number,
): PersonalizationTierRow[] {
  const reached = Number.isFinite(effectiveTier)
    ? Math.max(0, Math.floor(effectiveTier))
    : 0;

  return PERSONALIZATION_AXES.map((axis, index) => {
    const tier = index + 1;
    return {
      key: axis.key,
      tier,
      title: axis.title,
      unlockHint: axis.unlockHint,
      unlocked: reached >= tier,
    };
  });
}
