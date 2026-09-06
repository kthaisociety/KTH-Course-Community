/**
 * Placement: where a joining node lands in the community graph, and what it
 * looks like when it gets there.
 *
 * Everything here is pure and deterministic. World units are not browser
 * pixels — the frontend projects them and its responsive adjustments never
 * come back to the database.
 */

/**
 * The appearance vocabulary lives in `./appearance.ts` — the palette, the two
 * shape axes, the unconfigured state, and which tier unlocks each of them. It
 * is re-exported here because placement writes the unconfigured state on join
 * and every existing importer of these names came through this module.
 *
 * **Nobody is assigned a colour.** Placement writes the unconfigured state and
 * never hashes an app user onto a palette name: a node profile is
 * personalisation, so a colour is chosen, never dealt out. `graph.setAppearance`
 * is the only writer of a chosen value, and it is driven by a member clicking
 * one.
 */
export {
  DEFAULT_NODE_COLOR,
  DEFAULT_NODE_SIGNAL_STYLE,
  DEFAULT_NODE_STYLE,
  NODE_COLORS,
  type NodeColor,
  type StoredNodeColor,
  type StoredNodeSignalStyle,
  type StoredNodeStyle,
} from "./appearance";

/** A joining node takes roughly three to five anchors. */
export const MIN_ANCHORS = 3;
export const MAX_ANCHORS = 5;

export type WorldPosition = { x: number; y: number };

/**
 * Radial spacing between successive placements, in world units. Radius grows
 * with the square root of the community size so nodes stay at roughly constant
 * density instead of thinning out as the graph grows.
 */
const RADIUS_STEP = 120;

/** The golden angle, which spreads successive placements evenly around the origin. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/**
 * Angular wobble, in radians, applied per app user. It keeps two people who
 * join against the same community size off the same point without disturbing
 * the radius, which stays a pure function of the placement index.
 */
const ANGLE_JITTER = 0.08;

/** Deterministic anchor count for an app user, within `[MIN_ANCHORS, MAX_ANCHORS]`. */
export function chooseAnchorCount(userId: string): number {
  const span = MAX_ANCHORS - MIN_ANCHORS + 1;
  // Salted, so anchor count and world position are drawn from different slices
  // of the hash and cannot correlate.
  return MIN_ANCHORS + (hashUserId(`anchors:${userId}`) % span);
}

/**
 * Where a joining node goes, given how many nodes are already placed.
 *
 * New nodes land at the outer edge of the current community: the radius is a
 * strictly increasing function of `placedNodeCount`, so joining pushes outward
 * and never asks an established node to move. Placement is local and additive
 * by construction — there is no global layout pass.
 */
export function computeWorldPosition(
  userId: string,
  placedNodeCount: number,
): WorldPosition {
  const index = Math.max(0, Math.trunc(placedNodeCount));
  const radius = RADIUS_STEP * Math.sqrt(index);
  const jitter = (unitFromHash(`angle:${userId}`) * 2 - 1) * ANGLE_JITTER;
  const angle = index * GOLDEN_ANGLE + jitter;
  return {
    x: roundWorldUnit(radius * Math.cos(angle)),
    y: roundWorldUnit(radius * Math.sin(angle)),
  };
}

/** World units are stored as double precision; a micro-unit is far below what renders. */
function roundWorldUnit(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/** FNV-1a, 32-bit unsigned. Stable across processes, unlike `Math.random`. */
function hashUserId(userId: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < userId.length; i++) {
    hash ^= userId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/** The same hash mapped into `[0, 1)`. */
function unitFromHash(seed: string): number {
  return hashUserId(seed) / 0x100000000;
}
