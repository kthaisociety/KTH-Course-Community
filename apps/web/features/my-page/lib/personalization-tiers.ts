/**
 * The personalization tiers My Page's "My dot" tab lists, and where the viewer
 * stands on each of them.
 *
 * **There is one definition of the ladder and it is not here.**
 * `@/server/graph/appearance` owns which tier unlocks which axis, what each axis
 * offers, and the unlocked/dormant/locked rule; it lives in `server/` because
 * Biome forbids server code importing from `features/`, so the side both halves
 * can reach is that one. This module re-exports it and adds nothing but the row
 * shape the tab renders. The tier gate in `server/graph/service.ts` runs the
 * *same* `PERSONALIZATION_AXES` — offering an option the server would refuse is
 * exactly what a second copy would produce.
 *
 * Two rules govern the numbers, both from `CONTEXT.md` and #93.
 *
 * **What may be edited is the effective tier.** `users.personalization_tier_
 * earned` holds the highest tier ever reached and is never lowered;
 * `graph.personalization` derives what inactivity has left of it. A row is
 * editable only when the effective tier reaches it.
 *
 * **The earned tier is only ever used to say "dormant".** It never unlocks
 * anything and it is never phrased as a loss. It exists here so that an axis
 * somebody earned and has gone quiet on reads as **Dormant** — its pick still
 * stored, waiting — rather than as **Locked**, which would tell them they had
 * lost something the database still holds. This tab used to collapse the two
 * because `graph.effectiveTier` returned a single number; it returns both now,
 * and the limitation is gone rather than documented.
 */

import {
  type AxisState,
  axisState,
  PERSONALIZATION_AXES,
  type PersonalizationAxisKey,
  UNCONFIGURED,
} from "@/server/graph/appearance";

export {
  type AxisState,
  axisState,
  NODE_COLORS,
  NODE_SIGNAL_STYLES,
  NODE_STYLES,
  type NodeAppearance,
  type NodeAppearanceChoice,
  PERSONALIZATION_AXES,
  type PersonalizationAxisKey,
  UNCONFIGURED,
} from "@/server/graph/appearance";

export type PersonalizationTierRow = {
  key: PersonalizationAxisKey;
  /** The tier that unlocks this axis: 1, 2 or 3. */
  tier: number;
  title: string;
  unlockHint: string;
  state: AxisState;
  /** Editable right now. The one thing the picker may act on. */
  unlocked: boolean;
  /**
   * Every value this axis may hold, unconfigured first.
   *
   * `UNCONFIGURED` leads because it is what every node in the community starts
   * as and what a dormant axis renders as — and because a member who has picked
   * something needs a way back to it.
   */
  options: readonly string[];
};

/**
 * The three rows, marked against a viewer's two tier numbers.
 *
 * Neither number is trusted: the column allows 0-3 today, and a build that meets
 * a wider or absent value should still render three sensible rows instead of
 * throwing on somebody's own page. `axisState` does the clamping, once.
 */
export function personalizationTierRows(
  earnedTier: number,
  effectiveTier: number,
): PersonalizationTierRow[] {
  return PERSONALIZATION_AXES.map((axis) => {
    const state = axisState(axis, earnedTier, effectiveTier);
    return {
      key: axis.key,
      tier: axis.tier,
      title: axis.title,
      unlockHint: axis.unlockHint,
      state,
      unlocked: state === "unlocked",
      options: [UNCONFIGURED, ...axis.options],
    };
  });
}
