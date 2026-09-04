/**
 * Turning a bounded neighbourhood of the community graph into something the
 * hero canvas can draw.
 *
 * **World units are not browser pixels.** `graph.neighbourhood` hands back the
 * persisted world positions untouched; everything in this file is derived at
 * read time and thrown away on the next resize. Nothing here is ever written
 * back — the projection, the chosen centre and the fitted scale are all
 * responsive decisions the client owns, exactly as
 * `docs/landing_docs/personal-community-viewport.md` requires.
 *
 * The projection is the one from that document:
 *
 * ```
 * screenX = (node.x - viewer.x) * scale + centre.x
 * screenY = (node.y - viewer.y) * scale + centre.y
 * ```
 *
 * The only liberty taken with it is `centre`, which is *not* the middle of the
 * canvas: the middle of the hero is where the headline is. Picking a centre in
 * a clear region is the "responsive keep-out adjustment" the document permits,
 * and it moves the camera, never a node.
 */

import { distToContent, type Rect } from "./hero-field";

/**
 * The node colour palette, as the server stores it: **names, never hex**.
 * `server/graph/placement.ts` owns the list; this is the client half of the
 * contract, mapping each name onto a `--cc-*` custom property so the palette
 * can be re-skinned in CSS without a data migration.
 */
export const NODE_COLOR_VARS = {
  aurora: "--cc-node-aurora",
  ember: "--cc-node-ember",
  frost: "--cc-node-frost",
  moss: "--cc-node-moss",
  slate: "--cc-node-slate",
  violet: "--cc-node-violet",
} as const;

export type NodeColorName = keyof typeof NODE_COLOR_VARS;

/**
 * What an unrecognised colour name draws as. The column is free text in the
 * database, so a name this build has never heard of is possible; drawing it in
 * the neutral is better than dropping the node from someone's neighbourhood.
 */
export const FALLBACK_NODE_COLOR_VAR = NODE_COLOR_VARS.slate;

export function nodeColorVar(name: string): string {
  return name in NODE_COLOR_VARS
    ? NODE_COLOR_VARS[name as NodeColorName]
    : FALLBACK_NODE_COLOR_VAR;
}

/** Exactly the shape `graph.neighbourhood` returns, narrowed to what is drawn. */
export type NeighbourhoodInput = {
  viewer: { userId: string; x: number; y: number };
  nodes: { userId: string; x: number; y: number; color: string }[];
  edges: { nodeUserId: string; anchorUserId: string }[];
};

/** One node placed on the canvas. Derived, never persisted. */
export type ScreenNode = {
  userId: string;
  screenX: number;
  screenY: number;
  /** The custom property this node's stored colour name maps onto. */
  colorVar: string;
  isViewer: boolean;
  /** 1 well clear of the hero copy, 0 underneath it. */
  clearance: number;
};

export type NeighbourhoodView = {
  scale: number;
  centre: { x: number; y: number };
  nodes: ScreenNode[];
  /**
   * The backbone edges of the set, as pairs of placed nodes.
   *
   * A backbone edge records placement history and **is not a friendship**. It
   * is drawn undirected here for exactly that reason: an arrow would suggest a
   * direction of feeling that the data does not carry.
   */
  edges: [ScreenNode, ScreenNode][];
};

/** Padding kept between the outermost node and the frame, in px. */
const FIT_PADDING = 28;
/** A neighbourhood of one has no extent to fit, so it takes this scale. */
export const DEFAULT_SCALE = 0.6;
export const MIN_SCALE = 0.02;
export const MAX_SCALE = 1.4;

/**
 * Where the viewer's own node lands on the canvas.
 *
 * Sampled rather than solved: a coarse grid, scored on how far each candidate
 * sits from the hero copy, with a mild pull back towards the middle of the
 * frame so an empty hero does not shove the graph into a corner.
 */
export function pickViewportCentre(
  width: number,
  height: number,
  keepOut: Rect[],
): { x: number; y: number } {
  const middle = { x: width / 2, y: height / 2 };
  if (keepOut.length === 0) return middle;

  const steps = 12;
  const span = Math.hypot(width, height) || 1;
  let best = middle;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let ix = 1; ix < steps; ix++) {
    for (let iy = 1; iy < steps; iy++) {
      const x = (width * ix) / steps;
      const y = (height * iy) / steps;
      const clear = distToContent(x, y, keepOut);
      const pull = Math.hypot(x - middle.x, y - middle.y) / span;
      const score = clear / span - pull * 0.35;
      if (score > bestScore) {
        bestScore = score;
        best = { x, y };
      }
    }
  }
  return best;
}

/**
 * The largest scale that still fits every node in the neighbourhood inside the
 * frame, given where the centre ended up. Each direction is fitted separately,
 * because the centre is rarely in the middle.
 */
export function fitScale(
  input: NeighbourhoodInput,
  width: number,
  height: number,
  centre: { x: number; y: number },
): number {
  const room = {
    left: Math.max(1, centre.x - FIT_PADDING),
    right: Math.max(1, width - centre.x - FIT_PADDING),
    up: Math.max(1, centre.y - FIT_PADDING),
    down: Math.max(1, height - centre.y - FIT_PADDING),
  };

  let scale = MAX_SCALE;
  let spread = false;
  for (const node of input.nodes) {
    const dx = node.x - input.viewer.x;
    const dy = node.y - input.viewer.y;
    if (dx !== 0 || dy !== 0) spread = true;
    if (dx < 0) scale = Math.min(scale, room.left / -dx);
    if (dx > 0) scale = Math.min(scale, room.right / dx);
    if (dy < 0) scale = Math.min(scale, room.up / -dy);
    if (dy > 0) scale = Math.min(scale, room.down / dy);
  }
  // Nobody but the viewer, or everyone stacked on them: there is no extent to
  // fit, so the scale is a preference rather than a measurement.
  if (!spread) return DEFAULT_SCALE;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/**
 * Project a neighbourhood onto a canvas of `width` by `height`.
 *
 * The result is pure derivation: `input` is not mutated, and nothing computed
 * here has anywhere to go but the canvas.
 */
export function projectNeighbourhood(args: {
  neighbourhood: NeighbourhoodInput;
  width: number;
  height: number;
  keepOut: Rect[];
}): NeighbourhoodView {
  const { neighbourhood, width, height, keepOut } = args;
  const centre = pickViewportCentre(width, height, keepOut);
  const scale = fitScale(neighbourhood, width, height, centre);

  const byUser = new Map<string, ScreenNode>();
  const nodes = neighbourhood.nodes.map((node) => {
    const screenX = (node.x - neighbourhood.viewer.x) * scale + centre.x;
    const screenY = (node.y - neighbourhood.viewer.y) * scale + centre.y;
    const isViewer = node.userId === neighbourhood.viewer.userId;
    const placed: ScreenNode = {
      userId: node.userId,
      screenX,
      screenY,
      colorVar: nodeColorVar(node.color),
      isViewer,
      // The centre is picked to be clear, so the viewer's own node is already
      // in the open — and dimming the one dot the flow exists to reveal would
      // defeat it. Everyone else fades under the copy.
      clearance: isViewer ? 1 : keepOutClearance(screenX, screenY, keepOut),
    };
    byUser.set(node.userId, placed);
    return placed;
  });

  const edges: [ScreenNode, ScreenNode][] = [];
  for (const edge of neighbourhood.edges) {
    const from = byUser.get(edge.nodeUserId);
    const to = byUser.get(edge.anchorUserId);
    if (from && to) edges.push([from, to]);
  }

  return { scale, centre, nodes, edges };
}

/** How visible a node is where it landed: 0 under the copy, 1 well clear of it. */
function keepOutClearance(x: number, y: number, keepOut: Rect[]): number {
  if (keepOut.length === 0) return 1;
  const distance = distToContent(x, y, keepOut);
  return Math.min(1, distance / 24);
}
