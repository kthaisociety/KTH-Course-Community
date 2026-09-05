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
 * **The design disagreed with itself about tiers 2 and 3, and the product owner
 * settled it on 2026-09-05: the rendered list wins.** The My Page artboard
 * draws `mk(2, "Dot style", …, "style")` and `mk(3, "Signal on click", …,
 * "signalStyle")`, while `cc-store.js`'s `TIER_AXES` constant says
 * `{ 1: "color", 2: "signalStyle", 3: "style" }` — the opposite pairing. Both
 * halves survived the 2026-09-05 export unchanged, so the revision did not
 * settle it and a reader could not tell which half to believe.
 *
 * The rendered list is what a reader of the artboard actually sees, and it puts
 * the most visible reward behind the hardest contribution: tier 3 is reviewing
 * an entire imported transcript, and a moving signal reads louder than a static
 * shape. `cc-store.js` is the erroneous half and wants correcting at source.
 *
 * `unlockHint` is the rule from ADR 0005, which is what `server/graph/tier.ts`
 * now actually enforces. It used to carry the artboard's own copy, which named
 * a different ladder entirely — five reviews, then a fully reviewed transcript,
 * then *referring friends*, a feature that does not exist. That was harmless
 * while nothing wrote the column and every account sat at tier 0. It stopped
 * being harmless the moment the writer shipped, because a hint that names an
 * unearnable act is a promise the app cannot keep.
 */
export const PERSONALIZATION_AXES = [
  {
    key: "color",
    title: "Dot color",
    unlockHint: "Unlocks when you publish your first review.",
  },
  {
    key: "style",
    title: "Dot style",
    unlockHint: "Unlocks when you import a transcript.",
  },
  {
    key: "signalStyle",
    title: "Signal on click",
    unlockHint: "Unlocks when every course in your transcript has your review.",
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
