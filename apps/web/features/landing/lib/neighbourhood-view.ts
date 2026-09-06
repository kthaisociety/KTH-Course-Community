/**
 * Turning a bounded window on the community graph into something the hero
 * canvas can draw.
 *
 * **World units are not browser pixels.** `graph.neighbourhood` and
 * `graph.publicWindow` hand back the persisted world positions untouched;
 * everything in this file is derived at read time and thrown away on the next
 * resize. Nothing here is ever written back, exactly as
 * `docs/landing_docs/personal-community-viewport.md` requires.
 *
 * The projection is that document's, taken literally:
 *
 * ```
 * screenX = (node.x - centre.x) * scale + anchorX
 * screenY = (node.y - centre.y) * scale + anchorY
 * ```
 *
 * The bug this file was written against — two members standing in the same
 * region of the graph seeing different pictures of it — was the **scale**. It
 * used to be fitted to the viewer's own neighbourhood extent, so the same two
 * dots rendered at different zooms for two different people. It is a constant
 * now, `VIEW_SCALE`, and it is not a function of anything.
 *
 * The anchor was removed at the same time and that was collateral damage. It
 * is back, because it is provably not the same kind of thing:
 *
 * ```
 * screen(p) − screen(q) = (p − q) · s
 * ```
 *
 * Both the window centre and the anchor cancel, so every pair of nodes keeps
 * the same separation and the same bearing on every screen no matter where the
 * anchor lands. It is a pure function of the frame and the copy — no viewer
 * argument, no search over the graph — which is exactly the "responsive
 * keep-out adjustment" the viewport document lists as derived and never written
 * back. `pickViewportCentre` below is that function.
 *
 * What it buys, beyond the copy staying readable, is that the viewer's own node
 * lands *on* the anchor by identity: `input.centre` **is** their persisted
 * world position, so their offset from it is zero. No search for their dot, no
 * special case, nothing stored. It holds across sessions for as long as the
 * frame and the copy layout hold — a resize or a reworded headline moves the
 * anchor, and that is a responsive adjustment rather than a broken promise.
 *
 * Keep-out is no longer only a fade. `pushClear` walks a node out from under
 * the copy first, and the fade is what is left for the case it refuses; see
 * `hero-keepout.ts` for why the artboard's own engine makes that the faithful
 * port rather than a liberty. Issue #68 settled the opposite — "the centre is
 * the viewport centre", "keep-out may only fade nodes" — and both of those are
 * superseded here on the product owner's instruction.
 */

import {
  NODE_SIGNAL_STYLES,
  NODE_STYLES,
  type NodeColor,
  type NodeSignalStyle,
  type NodeStyle,
  UNCONFIGURED,
} from "@/server/graph/appearance";
import {
  clearAt,
  distToContent,
  lineClearance,
  pushClear,
  type Rect,
} from "./hero-keepout";

/**
 * The node colour palette, as the server stores it: **names, never hex**.
 * `server/graph/appearance.ts` owns the list; this is the client half of the
 * contract, mapping each name onto a `--cc-*` custom property so the palette
 * can be re-skinned in CSS without a data migration.
 *
 * Typed as a total map over the server's `NodeColor`, so adding a name there
 * without a token here is a build error rather than a node that quietly draws
 * in the fallback.
 */
export const NODE_COLOR_VARS: Record<NodeColor, string> = {
  aurora: "--cc-node-aurora",
  ember: "--cc-node-ember",
  frost: "--cc-node-frost",
  moss: "--cc-node-moss",
  slate: "--cc-node-slate",
  violet: "--cc-node-violet",
};

export type NodeColorName = NodeColor;

/**
 * What a node with no configured appearance draws as, which today is every
 * node: `users_node_profiles.color` defaults to `"default"` and placement
 * stores exactly that.
 *
 * The brand blue is the Landing artboard's own answer — its palette has a
 * single dot colour, `PAL.light.dot` = `#1751a6` and `PAL.dark.dot` in the
 * dark, which are `--cc-brand` in both themes.
 */
export const DEFAULT_NODE_COLOR_VAR = "--cc-brand";

/**
 * What an unrecognised colour name draws as. The column is free text, so a name
 * this build has never heard of is possible; it draws as an unconfigured node,
 * which is what it effectively is, rather than being dropped from somebody's
 * neighbourhood or guessed at.
 */
export const FALLBACK_NODE_COLOR_VAR = DEFAULT_NODE_COLOR_VAR;

export function nodeColorVar(name: string): string {
  if (name in NODE_COLOR_VARS) return NODE_COLOR_VARS[name as NodeColorName];
  return FALLBACK_NODE_COLOR_VAR;
}

/**
 * What a node with no configured shape draws as: the filled dot every node in
 * the community has always been. `"solid"` names the same geometry, which is
 * why an unconfigured node and a node whose owner chose "solid" are
 * indistinguishable on the canvas — that is the design, not an oversight. The
 * distinction lives in the column, and it matters when the member changes their
 * mind rather than when the pixels land.
 */
export const DEFAULT_NODE_STYLE_NAME = "solid" as const;

/** What a node with no configured signal draws as: no signal at all. */
export const NO_SIGNAL = "none" as const;

/** The shape a stored style name draws with. Anything unrecognised is a dot. */
export function nodeStyleName(name: string): NodeStyle {
  return (NODE_STYLES as readonly string[]).includes(name)
    ? (name as NodeStyle)
    : DEFAULT_NODE_STYLE_NAME;
}

/**
 * The signal a stored name draws, or `"none"`.
 *
 * `UNCONFIGURED` is the common case and means the node carries no signal — a
 * **signal** is ongoing, so "not carrying one" is a real state rather than a
 * quieter version of carrying one. An unrecognised name lands here too: a build
 * that has never heard of a signal style draws none rather than guessing.
 */
export function nodeSignalStyleName(
  name: string,
): NodeSignalStyle | typeof NO_SIGNAL {
  if (name === UNCONFIGURED) return NO_SIGNAL;
  return (NODE_SIGNAL_STYLES as readonly string[]).includes(name)
    ? (name as NodeSignalStyle)
    : NO_SIGNAL;
}

/**
 * Exactly the shape `graph.neighbourhood` and `graph.publicWindow` return,
 * narrowed to what is drawn.
 *
 * `id` is opaque and generated per response: it joins a node to that response's
 * edges and means nothing outside it. There is deliberately no user id here —
 * see `server/graph/service.ts`.
 */
export type GraphWindowInput = {
  centre: { x: number; y: number };
  nodes: {
    id: string;
    x: number;
    y: number;
    /**
     * The three appearance names, already masked by the server: an axis whose
     * owner's tier has decayed arrives as `"default"` while their pick stays in
     * the column. Nothing on this side undoes that, and nothing on this side
     * needs a tier number to draw a node.
     */
    color: string;
    style: string;
    signalStyle: string;
    isViewer: boolean;
  }[];
  edges: { fromId: string; toId: string }[];
};

/** One node placed on the canvas. Derived, never persisted. */
export type ScreenNode = {
  id: string;
  screenX: number;
  screenY: number;
  /** The custom property this node's stored colour name maps onto. */
  colorVar: string;
  /** The shape to draw: `solid`, `ring` or `diamond`. */
  style: NodeStyle;
  /** The signal to draw along it, or `"none"` when it carries none. */
  signalStyle: NodeSignalStyle | typeof NO_SIGNAL;
  isViewer: boolean;
  /** 1 well clear of the hero copy, 0 underneath it. */
  clearance: number;
};

/**
 * One backbone edge placed on the canvas.
 *
 * A backbone edge records placement history and **is not a friendship**. It is
 * drawn undirected for exactly that reason: an arrow would suggest a direction
 * of feeling the data does not carry. `clearance` is sampled along the whole
 * line, because two endpoints in the open can still span the headline.
 */
export type ScreenEdge = {
  from: ScreenNode;
  to: ScreenNode;
  clearance: number;
};

/**
 * A projected window, ready to paint.
 *
 * `scale` and `centre` are the projection's own parameters rather than
 * something the canvas reads — it draws `screenX`/`screenY` and nothing else.
 * They are here because they are what makes the result checkable: a test can
 * ask where the anchor landed and whether the zoom is still a constant, which
 * are the two properties this file exists to hold.
 */
export type GraphWindowView = {
  scale: number;
  /** The anchor: where the window's centre, and so the viewer, landed. */
  centre: { x: number; y: number };
  nodes: ScreenNode[];
  edges: ScreenEdge[];
};

/**
 * Pixels per world unit. A **constant**, and that is the whole point.
 *
 * `personal-community-viewport.md` calls the visible-node maximum "a
 * frontend/query policy", so the number is ours to choose — but it may not be a
 * function of who is looking or of what their neighbourhood happens to contain,
 * or two people in one region of the graph see it at two different zooms.
 *
 * 0.72 is chosen against the density placement actually produces. Radius grows
 * as `120 * sqrt(n)`, so the community covers `pi * 120^2 * n` world units and
 * every node has about 45 000 of them to itself. A frame of `w * h` pixels
 * therefore shows roughly `w * h / (0.72^2 * 45000)` nodes — about 55 across the
 * artboard's 1440x900 hero, which is what the artboard draws, and about 10
 * across a phone, which is the sparser field its Mobile Preview draws. The
 * breakpoint the artboards have falls out of the frame size on its own; it does
 * not need a second constant to produce it.
 *
 * **The frame does not stay full as the community grows, and that is the
 * chosen behaviour.** The two things a reader tends to want here — a constant
 * visible gap between neighbours, and a hero that is as densely covered at
 * N=3 as at N=1000 — are mutually exclusive, because a sunflower of `n` nodes
 * covers area proportional to `n` however it is scaled. `computeWorldPosition`
 * already delivers the first: nearest-neighbour distance measures flat at about
 * 201 world units from N=10 to N=1000, which is a constant ~145px on screen at
 * this scale. What changes with N is coverage, not spacing. The product owner
 * has chosen spacing, so there is deliberately **no density policy** here: no
 * scale that reads the node count, and nothing in `server/graph/placement.ts`
 * that spreads the community out to fill a viewport. A sparse hero early on is
 * the community being small, drawn honestly.
 */
export const VIEW_SCALE = 0.72;

/** Drawn radius of an ordinary node, in px. A dot is cleared by its edge. */
export const NODE_RADIUS = 4;

/** How coarse the anchor search is, per axis. */
const ANCHOR_STEPS = 12;

/**
 * How much room around the anchor counts as enough, in px.
 *
 * Clearance is a **threshold, not a quantity**: a dot 400px from the headline is
 * no more legible than one 30px from it, so past a point more room buys nothing
 * and the anchor should stop chasing it. 25px is chosen against what actually
 * gets drawn on the anchor — **Find your dot** enlarges the node to a radius of
 * 7.5 inside a 12.5px ring — and against `SAFETY`, which has already put 25px of
 * padding between every rect and the text inside it. So an anchor 25px clear of
 * a padded rect puts the whole reveal about 50px from anything a reader is
 * looking at.
 *
 * The version of this function that was deleted in `2ca7f52` scored raw
 * distance instead, and the two ends of that are both wrong. Measured against
 * the rendered hero: on a 1920x600 frame it maximised out into a corner, and on
 * a 360x480 one — where the whole frame is close to the copy and no candidate
 * scores much — the centrality pull won outright and the anchor landed *inside
 * the headline*, `clearAt` 0.00. Saturating fixes both.
 */
const ANCHOR_COMFORT = 25;

/**
 * How hard the anchor is pulled back towards the middle of the frame.
 *
 * Clearance alone would shove the graph into whichever corner happens to be
 * emptiest, which reads as a mistake rather than as a composition. Both terms
 * are normalised to 0..1, so this is a preference between two comfortable
 * candidates and never a veto on the comfortable one.
 */
const ANCHOR_PULL = 0.35;

/**
 * Where the middle of the graph sits on the canvas.
 *
 * A pure function of the frame and the measured copy — **it takes no viewer**,
 * and that is the whole of why it is allowed to exist. It moves the camera, not
 * a node, so every relative position in the window is untouched by it.
 *
 * Sampled rather than solved: a coarse grid, each candidate scored on whether
 * it has comfortable room and then on how near the middle it is. The winner is
 * handed to `pushClear`, which is what turns "the best of eleven-by-eleven
 * guesses" into "actually clear", and which hands it back untouched when the
 * copy leaves nowhere within `MAX_PUSH` to stand — a hero whose copy covers its
 * whole frame therefore falls back to the middle of it, which is where this used
 * to be unconditionally.
 *
 * **What is and is not promised across sessions.** For a given frame size and a
 * given copy layout this is deterministic, so a returning member finds their own
 * dot in the same place on the glass — on the rendered hero that is the top
 * centre, a twelfth of the way down, at both 1920x600 and 360x480. Resize the
 * window or reword the headline and the anchor moves, which is a responsive
 * adjustment and not a broken promise. Two candidates can also tie on score, and
 * the earlier one in the scan wins; a copy edit that flips such a tie moves the
 * dot. Neither is written anywhere, so neither can drift out of step with the
 * stored world position — that is the property that actually matters.
 */
export function pickViewportCentre(
  width: number,
  height: number,
  keepOut: Rect[],
): { x: number; y: number } {
  const middle = { x: width / 2, y: height / 2 };
  if (keepOut.length === 0) return middle;

  const span = Math.hypot(width, height) || 1;
  let best = middle;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let ix = 1; ix < ANCHOR_STEPS; ix++) {
    for (let iy = 1; iy < ANCHOR_STEPS; iy++) {
      const x = (width * ix) / ANCHOR_STEPS;
      const y = (height * iy) / ANCHOR_STEPS;
      const room =
        Math.min(distToContent(x, y, keepOut), ANCHOR_COMFORT) / ANCHOR_COMFORT;
      const pull = Math.hypot(x - middle.x, y - middle.y) / span;
      const score = room - pull * ANCHOR_PULL;
      if (score > bestScore) {
        bestScore = score;
        best = { x, y };
      }
    }
  }
  return pushClear(best.x, best.y, keepOut, NODE_RADIUS);
}

/**
 * Project a bounded window onto a canvas of `width` by `height`.
 *
 * The result is pure derivation: `input` is not mutated, and nothing computed
 * here has anywhere to go but the canvas.
 */
export function projectGraphWindow(args: {
  window: GraphWindowInput;
  width: number;
  height: number;
  keepOut: Rect[];
}): GraphWindowView {
  const { window: input, width, height, keepOut } = args;
  const centre = pickViewportCentre(width, height, keepOut);

  const byId = new Map<string, ScreenNode>();
  const nodes = input.nodes.map((node) => {
    // The projection proper. Everything after this line is keep-out.
    const projectedX = (node.x - input.centre.x) * VIEW_SCALE + centre.x;
    const projectedY = (node.y - input.centre.y) * VIEW_SCALE + centre.y;
    // The artboard would have rejected this placement and drawn somebody else
    // instead. A window on the real graph has no such option — every node here
    // is a person — so it is walked out of the copy rather than dropped.
    //
    // There is no exception for the viewer, and it needs none. Their node lands
    // on the anchor, `pushClear` is idempotent, and the anchor is itself its
    // output — so it is the identity for them in every frame where an anchor
    // could be found. In the frames where none could, it declines for them on
    // exactly the grounds it declined for the anchor, the same point against the
    // same rects, and they fade along with everybody else. That is honest: a
    // hero with no legible place left is better admitted than answered with one
    // dot drawn over the headline and called a reveal.
    //
    // `centre` is passed as the push's origin so the escape is radial. The
    // field is a sunflower around the window centre, and `centre` is where that
    // centre lands on screen, so a node's bearing from it *is* the golden-angle
    // separation that keeps it away from its neighbours. Pushing along that
    // bearing spends the spacing; pushing to the nearest wall throws it away,
    // because every point that leaves by one wall keeps only the coordinate the
    // wall did not set. See `pushClear` for the measurement.
    const { x: screenX, y: screenY } = pushClear(
      projectedX,
      projectedY,
      keepOut,
      NODE_RADIUS,
      centre,
    );
    const placed: ScreenNode = {
      id: node.id,
      screenX,
      screenY,
      colorVar: nodeColorVar(node.color),
      style: nodeStyleName(node.style),
      signalStyle: nodeSignalStyleName(node.signalStyle),
      isViewer: node.isViewer,
      // 1 for everything the push could place, which is the artboard's own
      // situation: there, `clearAt` is 1 for every dot that survived rejection.
      // It is below 1 only where the push gave up, and there it is doing the
      // job it always did.
      clearance: clearAt(screenX, screenY, keepOut, NODE_RADIUS),
    };
    byId.set(node.id, placed);
    return placed;
  });

  const edges: ScreenEdge[] = [];
  for (const edge of input.edges) {
    const from = byId.get(edge.fromId);
    const to = byId.get(edge.toId);
    if (!from || !to) continue;
    edges.push({
      from,
      to,
      clearance: lineClearance(
        { x: from.screenX, y: from.screenY },
        { x: to.screenX, y: to.screenY },
        keepOut,
      ),
    });
  }

  return { scale: VIEW_SCALE, centre, nodes, edges };
}
