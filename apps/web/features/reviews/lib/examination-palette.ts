import type { ExaminationDistribution } from "@/types";
import {
  EXAMINATION_DISTRIBUTION_KEYS,
  EXAMINATION_DISTRIBUTION_LABELS,
} from "@/types";

type ExaminationKey = (typeof EXAMINATION_DISTRIBUTION_KEYS)[number];

/**
 * Fill colours for the examination split, extracted from `EXAMINATION_COLORS`
 * in `docs/design_ref/2026-09-05/cc-store.js`.
 *
 * These are literal hexes rather than `--cc-*` tokens on purpose, and it is the
 * one place in this feature that is not styled against a token. A stacked bar
 * is a categorical data palette: a segment has to keep meaning the same
 * category in light and dark, so a theme-switching value would make the chart
 * lie. The design's own store carries them the same way, and
 * `apps/web/data/course-card-sample.ts` sets the precedent for holding design
 * literals in the repo verbatim.
 *
 * `seminars` is the sixth key the design never assigned — `cc-store.js` has
 * five, `apps/web/types/review.ts` has six, and the schema wins (issue #87).
 * `#4a7c2f` is a deep moss green: green is the only region of the wheel none of
 * the other five occupy, and it is far enough from `labs`' teal (roughly 80° of
 * hue apart, and much darker) that no two segments read as each other. It is
 * the same value `--cc-node-moss` took when the graph palette hit this exact
 * problem, so the repo says one thing about green rather than two.
 *
 * Its Swedish label is settled as "seminarier". The repo has no i18n layer, so
 * that is recorded here for whoever adds one and nothing more.
 */
export const EXAMINATION_COLORS: Record<ExaminationKey, string> = {
  exam: "#1751a6",
  assignments: "#dfa53c",
  labs: "#2f9e8e",
  projects: "#6a4ea8",
  seminars: "#4a7c2f",
  other: "#57646f",
};

/**
 * The text colour each fill takes, from `EXAMINATION_INK` in `cc-store.js`.
 * Light fills take dark ink and dark fills take white so a segment label stays
 * readable on its own segment. `seminars`' white reaches 4.98:1 on `#4a7c2f`.
 */
export const EXAMINATION_INK: Record<ExaminationKey, string> = {
  exam: "#ffffff",
  assignments: "#3a2a06",
  labs: "#06251f",
  projects: "#ffffff",
  seminars: "#ffffff",
  other: "#ffffff",
};

/** One drawn slice of the examination bar. */
export type ExaminationSegment = {
  key: ExaminationKey;
  /** "Labs 40%" when the slice is wide enough to hold a word, else "40%". */
  label: string;
  percent: number;
  color: string;
  ink: string;
};

/** Below this share a slice is too narrow for its category name to fit. */
const LABEL_WIDTH_THRESHOLD = 18;

/**
 * The distribution as ordered, drawable slices. A `null` distribution is "I
 * don't remember" and yields no slices at all — the caller renders the
 * unanswered state rather than a bar of zeroes. Keys the reviewer put at 0% are
 * dropped too: they answered, and the answer was "none of this".
 */
export function examinationSegments(
  distribution: ExaminationDistribution | null,
): ExaminationSegment[] {
  if (distribution === null) return [];
  return EXAMINATION_DISTRIBUTION_KEYS.filter(
    (key) => distribution[key] > 0,
  ).map((key) => {
    const percent = distribution[key];
    const name = EXAMINATION_DISTRIBUTION_LABELS[key];
    return {
      key,
      label:
        percent >= LABEL_WIDTH_THRESHOLD
          ? `${name} ${percent}%`
          : `${percent}%`,
      percent,
      color: EXAMINATION_COLORS[key],
      ink: EXAMINATION_INK[key],
    };
  });
}

/**
 * "50% / 30% / 20%" for the pill beside the bar, or `null` when the reviewer
 * did not remember.
 */
export function examinationSplitLabel(
  distribution: ExaminationDistribution | null,
): string | null {
  const segments = examinationSegments(distribution);
  if (segments.length === 0) return null;
  return segments.map((segment) => `${segment.percent}%`).join(" / ");
}
