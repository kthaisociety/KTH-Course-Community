import { EXAMINATION_DISTRIBUTION_KEYS } from "@/types";
import type { ExaminationKey } from "./review-draft";

/**
 * A colour per examination method, for the stacked bars that draw a split.
 *
 * **There is no examination palette in the design tokens.** The artboard hands
 * five raw hexes to five methods and never names the sixth; `globals.css` calls
 * an examination palette out as missing in the same breath as the node
 * colours. Inventing `--cc-exam-*` is exactly what #68 forbids, so this reuses
 * `--cc-node-*` — the one six-colour categorical set the theme actually has,
 * defined in both themes and guaranteed that no two read as each other.
 *
 * Four of the six land on the design's own hex (`labs`, `projects`, `other`
 * exactly; `exam` a shade off brand blue). `assignments` is the design's amber
 * moved to the palette's warm hue, and `seminars` — which the design never
 * assigned — takes the sixth. Flagged in the PR: if the design later publishes
 * an examination palette, this map is the single place it lands.
 */
export const EXAMINATION_COLOR_VAR: Record<ExaminationKey, string> = {
  exam: "var(--cc-node-frost)",
  assignments: "var(--cc-node-ember)",
  labs: "var(--cc-node-aurora)",
  projects: "var(--cc-node-violet)",
  seminars: "var(--cc-node-moss)",
  other: "var(--cc-node-slate)",
};

/**
 * Text drawn on top of a segment. The node colours are dark on the cream page
 * and light on the dark blue one, and `--cc-btn-fg` flips the same way, so one
 * token reads in both themes.
 */
export const EXAMINATION_INK_VAR = "var(--cc-btn-fg)";

/** The keys of a distribution that actually carry a share, biggest first. */
export function namedShares(
  distribution: Record<ExaminationKey, number>,
): { key: ExaminationKey; percent: number }[] {
  return EXAMINATION_DISTRIBUTION_KEYS.map((key, order) => ({
    key,
    order,
    percent: distribution[key],
  }))
    .filter((share) => share.percent > 0)
    .sort((a, b) => b.percent - a.percent || a.order - b.order)
    .map(({ key, percent }) => ({ key, percent }));
}
