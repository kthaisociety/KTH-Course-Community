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
 * screenX = (node.x - centre.x) * scale + viewportCentreX
 * screenY = (node.y - centre.y) * scale + viewportCentreY
 * ```
 *
 * Two earlier liberties with it are gone, and they were one bug: two members
 * standing in the same region of the graph saw different pictures of it.
 *
 * - The centre used to be grid-searched for a spot clear of the hero copy, so
 *   the camera followed the *headline layout* rather than the viewer. It is
 *   the middle of the frame now, full stop.
 * - The scale used to be fitted to the viewer's own neighbourhood extent, so
 *   the same two dots rendered at different zooms for two different people. It
 *   is a constant now — `VIEW_SCALE` — and it is not a function of anything.
 *
 * What survives of keep-out is a **fade**. A node under the copy is drawn
 * fainter or not at all; it is never moved, and neither is the camera. A world
 * position belongs to a person, and the hero has no licence to rearrange the
 * community so that a headline reads better.
 */

import {
  NODE_SIGNAL_STYLES,
  NODE_STYLES,
  type NodeColor,
  type NodeSignalStyle,
  type NodeStyle,
  UNCONFIGURED,
} from "@/server/graph/appearance";
import { clearAt, lineClearance, type Rect } from "./hero-keepout";

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

export type GraphWindowView = {
  scale: number;
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
 */
export const VIEW_SCALE = 0.72;

/** Drawn radius of an ordinary node, in px. A dot is faded by its edge. */
export const NODE_RADIUS = 4;

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
  const centre = { x: width / 2, y: height / 2 };

  const byId = new Map<string, ScreenNode>();
  const nodes = input.nodes.map((node) => {
    const screenX = (node.x - input.centre.x) * VIEW_SCALE + centre.x;
    const screenY = (node.y - input.centre.y) * VIEW_SCALE + centre.y;
    const placed: ScreenNode = {
      id: node.id,
      screenX,
      screenY,
      colorVar: nodeColorVar(node.color),
      style: nodeStyleName(node.style),
      signalStyle: nodeSignalStyleName(node.signalStyle),
      isViewer: node.isViewer,
      // The viewer's own node sits on the viewport centre, which is where the
      // hero copy is; fading it would hide the one node **Find your dot**
      // exists to reveal. Declining to fade a node is not moving it, and it is
      // the smallest exception that leaves the flow with something to show.
      clearance: node.isViewer
        ? 1
        : clearAt(screenX, screenY, keepOut, NODE_RADIUS),
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
