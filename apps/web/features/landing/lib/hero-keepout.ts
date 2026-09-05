/**
 * The hero's keep-out: where the landing copy is, and how visible a thing drawn
 * behind it should be.
 *
 * This file used to place a synthetic field of drifting dots as well — an
 * illustration of a community rather than the community. That is retired: the
 * hero draws the real community graph and nothing else, so all that is left
 * here is geometry. Nothing in it knows what a **Node** is; it answers "how far
 * is this pixel from the headline" and stops there.
 *
 * The one rule it exists to enforce is unchanged, only weaker in its remedy: a
 * dot or a line that lands on the hero copy fades out. It is never moved, and
 * the camera is never moved for it — a world position belongs to a person and
 * a responsive adjustment may not rearrange the community to suit a headline.
 *
 * Nothing here touches the DOM, a canvas or a clock, so every decision it makes
 * can be asserted on directly. `hero-network.tsx` owns the canvas and the
 * measuring and calls in here for the fades.
 */

/** A measured content box the hero must keep clear of, in canvas pixels. */
export type Rect = { x: number; y: number; w: number; h: number };

/** Width of the soft margin around the copy, in px. */
export const FEATHER = 10;
/** Extra padding added to every measured content rect, in px. */
export const SAFETY = 25;

/**
 * 1 well clear of the hero copy, easing to 0 inside it. `radius` grows the
 * point into a disc, so a dot is judged by its edge rather than its centre.
 *
 * This is the artboard's own function, and it is used the artboard's way: as a
 * multiplier on alpha. It fades; it never relocates.
 */
export function clearAt(x: number, y: number, rects: Rect[], radius = 0) {
  let m = 1;
  for (const r of rects) {
    const dx = Math.max(r.x - x, 0, x - (r.x + r.w)) - radius;
    const dy = Math.max(r.y - y, 0, y - (r.y + r.h)) - radius;
    const d = Math.hypot(Math.max(0, dx), Math.max(0, dy));
    if (d >= FEATHER) continue;
    const t = d / FEATHER;
    m = Math.min(m, t * t * (3 - 2 * t)); // smoothstep
  }
  return m;
}

/**
 * Sampled clearance along a line — 1 well clear of the copy, 0 crossing it.
 *
 * A backbone edge can be long, so its two ends being clear says nothing about
 * its middle: an edge between two dots either side of the headline would draw
 * straight through it. The line is sampled instead of its endpoints trusted.
 */
export function lineClearance(
  a: { x: number; y: number },
  b: { x: number; y: number },
  rects: Rect[],
) {
  let m = 1;
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    m = Math.min(
      m,
      clearAt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, rects),
    );
    if (m <= 0) break;
  }
  return m;
}

/** Keep-out used when the hero's own elements cannot be measured. */
export function fallbackRects(w: number, h: number): Rect[] {
  const copy = Math.min(780, w * 0.74);
  return [
    { x: w / 2 - copy / 2, y: 10, w: copy, h: h * 0.5 },
    { x: w / 2 - copy * 0.45, y: h * 0.5, w: copy * 0.9, h: h * 0.3 },
  ];
}
