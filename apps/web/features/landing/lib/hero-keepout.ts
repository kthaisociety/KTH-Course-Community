/**
 * The hero's keep-out: where the landing copy is, how far a pixel is from it,
 * and where a thing drawn behind it has to go instead.
 *
 * This file used to place a synthetic field of drifting dots as well — an
 * illustration of a community rather than the community. That is retired: the
 * hero draws the real community graph and nothing else, so all that is left
 * here is geometry. Nothing in it knows what a **Node** is; it answers "how far
 * is this pixel from the headline" and stops there.
 *
 * The rule it exists to enforce is the artboard's, and it is a *guarantee*
 * rather than a fade. `docs/design_ref/2026-09-06/Course Community -
 * Landing.dc.html` generates its field by rejection — `clearAt(x, y, 5) < 1`
 * throws a candidate away and it tries again — so no dot it draws is ever
 * within `FEATHER` of the copy, and the `clearAt` multiplier it then applies to
 * alpha is 1 for every dot that survived. The port kept that multiplier and
 * dropped the rejection, which is how nodes ended up under the headline being
 * faded to nothing instead of not being there.
 *
 * A projection cannot reject: every node in the window is somebody, and
 * declining to draw one is worse than moving it. So the rejection comes back as
 * `pushClear`, which walks a point out of the copy instead of throwing it away.
 * The fade stays as the backstop for the case `pushClear` refuses.
 *
 * Nothing here touches the DOM, a canvas or a clock, so every decision it makes
 * can be asserted on directly. `hero-network.tsx` owns the canvas and the
 * measuring and calls in here for the geometry.
 */

/** A measured content box the hero must keep clear of, in canvas pixels. */
export type Rect = { x: number; y: number; w: number; h: number };

/** Width of the soft margin around the copy, in px. */
export const FEATHER = 10;
/** Extra padding added to every measured content rect, in px. */
export const SAFETY = 25;

/**
 * How far `pushClear` will move a point before it gives up, in px.
 *
 * A cap is what keeps the push a local correction rather than a relayout. A
 * point deep under a full-width block of copy has no nearby way out, and
 * teleporting it across the hero would move a **world position**'s picture
 * further than the responsive adjustment it is allowed to be; that point stays
 * where it is and the fade hides it, exactly as before.
 */
export const MAX_PUSH = 120;

/**
 * Slack added to the exit distance, in px.
 *
 * `clearAt` measures with a subtraction the push has to invert, and floating
 * point does not promise that `r.x - m` lands exactly `m` away from `r.x`.
 * Landing a fraction of a pixel short would leave `clearAt` just under 1 and
 * make the post-condition untestable, so the push aims a hair further out.
 */
const PUSH_EPSILON = 1e-6;

/**
 * 1 well clear of the hero copy, easing to 0 inside it. `radius` grows the
 * point into a disc, so a dot is judged by its edge rather than its centre.
 *
 * This is the artboard's own function, unchanged. In the artboard it is both
 * the acceptance test for a placement and the alpha multiplier for what was
 * accepted, which is why it reads as redundant there: it is 1 for everything
 * that got drawn. It is used both ways here too, with `pushClear` doing the
 * accepting.
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
 * Distance from the content keep-out, in px. 0 when inside it.
 *
 * `clearAt` saturates: everything from `FEATHER` outwards is 1, so it cannot
 * rank two clear points against each other. This can, which is what choosing a
 * viewport anchor needs.
 */
export function distToContent(x: number, y: number, rects: Rect[]) {
  let m = Number.POSITIVE_INFINITY;
  for (const r of rects) {
    const dx = Math.max(r.x - x, 0, x - (r.x + r.w));
    const dy = Math.max(r.y - y, 0, y - (r.y + r.h));
    m = Math.min(m, Math.hypot(dx, dy));
  }
  return m;
}

/**
 * The nearest point to `(x, y)` that is genuinely clear of the copy.
 *
 * The contract is deliberately two-valued, because everything downstream leans
 * on it:
 *
 * - either the result satisfies `clearAt(result, rects, radius) === 1` and lies
 *   within `MAX_PUSH` of the input,
 * - or it **is** the input, unchanged.
 *
 * Two consequences follow, and they are the reason the shape is worth the
 * awkwardness. It is the identity wherever `clearAt` is already 1, so the only
 * points it can disturb are ones that were being faded towards invisibility
 * anyway. And it is idempotent in both branches, so pushing an already-pushed
 * point is a no-op rather than a second 120px of travel.
 *
 * The move is along **one axis, to the wall of some rect**: the candidates are
 * every rect's four walls taken one at a time, and the nearest candidate that is
 * clear of *all* of them wins. Moving on a single axis is what keeps a node
 * beside the headline it was under rather than dragging it diagonally across the
 * hero, and scoring each candidate against the whole set is what makes one pass
 * enough.
 *
 * Leaving each rect greedily by its own nearest wall — the obvious
 * implementation — does not work here, and the reason is worth recording:
 * `SAFETY` pads every rect by 25px a side, so the headline's own lines overlap
 * each other by more than they are apart, and a point between two of them is
 * pushed out of one into the next and back again for as many passes as it is
 * given. Scoring against the union has no such fixed point.
 *
 * `radius` is the drawn radius of the thing being placed, so it clears by its
 * edge and not by its centre.
 */
export function pushClear(
  x: number,
  y: number,
  rects: Rect[],
  radius = 0,
): { x: number; y: number } {
  // Already clear: the identity, and this branch is what makes it so.
  if (clearAt(x, y, rects, radius) === 1) return { x, y };

  // What the point has to end up outside a rect by. `clearAt` takes `radius`
  // off each axis before it measures, so clearing `FEATHER + radius` on one
  // axis is exactly what makes it return 1.
  const margin = FEATHER + radius + PUSH_EPSILON;
  let best: { x: number; y: number } | null = null;
  // Seeding the budget with the cap is what enforces it: a candidate further
  // away than this is never even tested.
  let bestTravel = MAX_PUSH;

  const consider = (cx: number, cy: number) => {
    const travel = Math.hypot(cx - x, cy - y);
    if (travel > bestTravel) return;
    // Ties go to the earlier candidate, and the rects arrive in DOM order, so
    // the choice is stable for a given frame rather than merely arbitrary.
    if (travel === bestTravel && best) return;
    if (clearAt(cx, cy, rects, radius) < 1) return;
    bestTravel = travel;
    best = { x: cx, y: cy };
  };

  for (const r of rects) {
    consider(r.x - margin, y);
    consider(r.x + r.w + margin, y);
    consider(x, r.y - margin);
    consider(x, r.y + r.h + margin);
  }

  // Nowhere within the budget: it stays put and the fade takes over.
  return best ?? { x, y };
}

/**
 * Sampled clearance along a line — 1 well clear of the copy, 0 crossing it.
 *
 * A backbone edge can be long, so its two ends being clear says nothing about
 * its middle: an edge between two dots either side of the headline would draw
 * straight through it. The line is sampled instead of its endpoints trusted,
 * and it stays a fade — `pushClear` places nodes, and an edge goes wherever the
 * two nodes it joins ended up.
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
