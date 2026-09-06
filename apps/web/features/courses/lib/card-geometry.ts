/**
 * The course card's collapse ramp.
 *
 * The card never measures anything. Its parent hands it one `geo` object, which
 * is what lets Explore interpolate the whole card from its results column as a
 * workspace pane is dragged open, while a list that measures nothing can pin an
 * end of the ramp instead. That split is the reason the card is one component
 * and not two.
 *
 * This used to name Saved and Collections as the two that pin, and Saved has
 * not pinned since #90's decision was reversed — `saved.tsx` ramps from its own
 * results width, and says so at length. Naming screens here is how the two
 * comments came to state opposite things about the same page, so the list is
 * gone: `courseCardGeometry`'s callers are who ramps, and the two pinned
 * constants below are who does not.
 *
 * Every number here is the artboard's:
 * `docs/design_ref/2026-09-06/Course Community - Explore.dc.html` computes exactly this ramp,
 * and at full width it lands on the `SAMPLE_GEO` literal in
 * `docs/design_ref/2026-09-06/Course Community - Course Card.dc.html`, which the fixture
 * mirrors — `card-geometry.spec.ts` holds those two together.
 */

import type { CardGeometry } from "@/types";

/** Below this the results column has stopped giving; the card is fully cropped. */
export const CARD_RAMP_FLOOR = 470;

/** The span over which the card grows back to full size. */
const CARD_RAMP_SPAN = 170;

/** At and above this width nothing is collapsed. */
export const CARD_RAMP_CEILING = CARD_RAMP_FLOOR + CARD_RAMP_SPAN;

/**
 * The action buttons hold their labels until the column is genuinely tight, so
 * they give way over the last stretch of the ramp rather than all the way down
 * it.
 */
const LATE_RAMP_END = 0.22;

/** One 19px line box of summary. Partial lines are never sliced. */
const SUMMARY_LINE_HEIGHT = 19;

/** Two lines of summary need this much of the ramp; one line needs the lower. */
const TWO_SUMMARY_LINES_FROM = 0.62;
const ONE_SUMMARY_LINE_FROM = 0.38;

/**
 * Below this the label is clipped rather than shortened, so the button drops it
 * and shows its icon alone.
 */
const LABEL_SURVIVES_ABOVE = 0.02;

/** What every geometry-driven property animates over as the ramp moves. */
export const CARD_TWEEN =
  "padding .18s ease-out, width .18s ease-out, gap .18s ease-out, max-height .18s ease-out, max-width .18s ease-out, opacity .14s ease-out, font-size .18s ease-out";

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Interpolates one pixel metric, rounded to a tenth so styles stay stable. */
function px(from: number, to: number, k: number): string {
  return `${Math.round((from + (to - from) * k) * 10) / 10}px`;
}

export type CardGeometryOptions = {
  /**
   * `false` while the reader is dragging the ramp: transitions chasing a value
   * that changes every frame lag behind the pointer instead of smoothing it.
   */
  animated?: boolean;
};

/**
 * The card's geometry at a given available width.
 *
 * `Infinity` — a column with nothing competing for it — is the fully expanded
 * end, and any width at or below {@link CARD_RAMP_FLOOR} is the fully collapsed
 * one. Everything between lerps, so no property of the card is ever binary
 * except the two that cannot be: whether a button keeps its label, and how many
 * whole lines of summary fit.
 */
export function courseCardGeometry(
  availableWidth: number,
  options: CardGeometryOptions = {},
): CardGeometry {
  const t = Number.isFinite(availableWidth)
    ? clamp01((availableWidth - CARD_RAMP_FLOOR) / CARD_RAMP_SPAN)
    : 1;
  const late = clamp01(t / LATE_RAMP_END);

  const summaryLines =
    t >= TWO_SUMMARY_LINES_FROM ? 2 : t >= ONE_SUMMARY_LINE_FROM ? 1 : 0;
  const showLabel = t > LABEL_SURVIVES_ABOVE;

  return {
    tween: options.animated === false ? "none" : CARD_TWEEN,
    titleSize: px(15.5, 17, t),
    cardGap: px(8, 10, t),
    cardPad: px(14, 18, t),
    factsGap: px(10, 14, t),
    // The Explore artboard interpolates this to 13px, its own `SAMPLE_GEO` to
    // 12px. The Course Card artboard is the authority for the card's own
    // geometry, so the ramp lands where its fixture does — and the card's markup
    // fixes this padding anyway, so nothing reads it.
    reviewPad: `0 ${px(10, 12, late)}`,
    labelMax: px(0, 120, late),
    labelOpacity: late,
    saveW: px(96, 126, late),
    savePad: px(10, 12, late),
    railW: px(134, 224, t),
    railPad: `${px(14, 18, t)} ${px(12, 16, t)}`,
    summaryMax: `${summaryLines * SUMMARY_LINE_HEIGHT}px`,
    summaryOpacity: summaryLines === 0 ? 0 : 1,
    reviewFlex: showLabel ? "0 1 132px" : "0 0 34px",
    saveFlex: showLabel ? "0 1 158px" : "0 0 68px",
    showLabel,
    cardHeight: "236px",
  };
}

/**
 * The card at full width: the top of the ramp, and what a list with no pane to
 * yield to starts from.
 *
 * Saved's own artboard passes a fully expanded geometry with a taller
 * `summaryMax` (57px, three lines) than this ramp ever reaches, which #68's body
 * — saying Saved pins the *collapsed* end — also disagrees with. Both ends are
 * exported so #90 can settle that against its own artboard; nothing here
 * forecloses either.
 */
export const EXPANDED_CARD_GEOMETRY = courseCardGeometry(
  Number.POSITIVE_INFINITY,
);

/** The card at its floor: no labels, no summary, the narrowest rail. */
export const COLLAPSED_CARD_GEOMETRY = courseCardGeometry(CARD_RAMP_FLOOR);
