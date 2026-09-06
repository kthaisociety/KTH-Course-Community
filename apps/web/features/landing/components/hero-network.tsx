"use client";

import { useEffect, useRef } from "react";
import type { GraphWindow } from "../api/queries";
import { fallbackRects, type Rect, SAFETY } from "../lib/hero-keepout";
import {
  advanceField,
  burstAt,
  createField,
  type FieldNode,
  hitTest,
  type Signal,
  signalPaint,
  syncField,
} from "../lib/hero-signals";
import {
  FALLBACK_NODE_COLOR_VAR,
  type GraphWindowView,
  NO_SIGNAL,
  NODE_COLOR_VARS,
  NODE_RADIUS,
  projectGraphWindow,
  type ScreenNode,
  VISIBLE,
} from "../lib/neighbourhood-view";

/**
 * The network behind the hero copy: the **real community graph**, always.
 *
 * It used to draw a synthetic Halton field of invented dots and cross-fade to
 * the real graph only if a member asked for it. Both halves of that were wrong.
 * An illustration of a community is not the community, and the community is not
 * something a person should have to ask to see, so there is one thing on this
 * canvas now — a bounded window on the stored graph:
 *
 * - a member's **graph window** is their own neighbourhood, centred on their
 *   own node;
 * - a visitor's is centred on the community origin, with no "You".
 *
 * **Find your dot** no longer swaps anything. The graph is already on screen;
 * the flow only labels the viewer's own node, and the reveal is the pulse and
 * the label appearing. The graph does not rearrange itself for it — the
 * artboard's words at :814, *"the graph never moves: the dot grows and pulses
 * in place"* — so the labelled node is also the one node that stops drifting
 * while the label is up.
 *
 * **The graph is alive, and that is a decision rather than a default.** Nodes
 * drift inside a ±5px box around where the projection put them, signals travel
 * along backbone edges, and a click fans one out along every backbone edge that
 * node has inside the drawn graph window.
 * The previous version of this file argued the opposite at length — that a
 * signal along a **backbone edge** would give it "a social meaning the data
 * does not have", and that a travelling signal would mean a frame loop that
 * never stops — and **ADR 0006 reverses both**. The edge is still not a
 * friendship, in the data or in `CONTEXT.md`; what the canvas asserts is only
 * that this is a community and things move through it, which is true, and the
 * still version of this hero made its most expensive feature indistinguishable
 * from a background image. The frame loop is real, and it is bounded by gates
 * rather than by having nothing to draw: it runs only while the hero is on
 * screen, un-paused, un-hidden, and motion is allowed. That is a weaker
 * guarantee than "painted once" and it is the price the ADR names.
 *
 * **Node appearance is drawn, and the third axis is the thing that moves.** A
 * node draws its `style` as a shape and its `signalStyle` as the wake its
 * signals leave — the third and last **personalization tier**, and the only
 * axis a member reaches by reviewing their entire transcript. Every node
 * signals; the tier picks the style and never whether it goes. The standing
 * still marks below (`FADE_RINGS`, `COMET_SEGMENTS`, `DASHED_RING`) are kept as
 * the **reduced-motion** form of the same three styles, so a member who chose
 * one still sees what they chose on a machine that has asked for stillness.
 *
 * The model — drift, spawn, relay, burst, trail geometry — lives in
 * `hero-signals.ts` as a pure function of the view and the elapsed time, seeded
 * from node and edge identity with no `Math.random()` anywhere. This file
 * measures, projects, paints, and owns the gates.
 *
 * Everything the projection derives — the scale, the anchor, the screen
 * coordinates, the keep-out push — is thrown away on the next resize. None of
 * it is ever sent back, and neither is a pixel of the drift. The measuring
 * below is what the derivation is a function of: one padded rect per rendered
 * content block, per line for a text block, so a resize or a font swap
 * re-derives rather than drifts.
 */

/** `PAL.dotA` and `PAL.lineA` from the Landing artboard's palette. */
const NODE_ALPHA = 0.82;
const EDGE_ALPHA = 0.26;

/**
 * A diamond's half-diagonal, as a multiple of `NODE_RADIUS`.
 *
 * Chosen so the square covers the same area as the circle it replaces: a square
 * of diagonal `d` has area `d^2 / 2`, so matching `pi * r^2` gives
 * `d = r * sqrt(2 * pi)` and a half-diagonal of `r * sqrt(pi / 2)`, about 1.25.
 * Without it a diamond inscribed in the same radius reads as a markedly smaller
 * node, and a member who picked a shape would appear to have shrunk.
 */
const DIAMOND_REACH = Math.sqrt(Math.PI / 2);

/** How much fainter than its node a standing-still signal mark is drawn. */
const SIGNAL_ALPHA = 0.5;

/**
 * `fade`: concentric rings, each fainter and wider than the last — a trail that
 * has spread out and gone soft rather than one caught mid-flight.
 *
 * Radii are multiples of `NODE_RADIUS`, so the whole mark scales with the dot.
 */
const FADE_RINGS = [
  { reach: 1.9, alpha: 0.34 },
  { reach: 2.9, alpha: 0.19 },
  { reach: 3.9, alpha: 0.1 },
];

/**
 * `comet`: a tapering trail behind the node, as segments of falling width and
 * alpha. `from`/`to` are distances from the node centre in multiples of
 * `NODE_RADIUS`; the head is nearest the node and the tail thins away from it.
 */
const COMET_SEGMENTS = [
  { from: 1.1, to: 2.5, width: 1.7, alpha: 0.62 },
  { from: 2.5, to: 3.9, width: 1.2, alpha: 0.36 },
  { from: 3.9, to: 5.4, width: 0.8, alpha: 0.16 },
];

/** `dashed`: one broken ring, as a radius multiple and a dash pattern in px. */
const DASHED_RING = { reach: 2.4, dash: [2.2, 2.6], alpha: 0.55, width: 1.1 };

type Scene = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  root: HTMLElement;
  w: number;
  h: number;
  dpr: number;
  raf: number;
  reduced: boolean;
  /** Seconds the pulse has been running, and only ever while it is running. */
  pulse: number;
  last: number;
  /** Find your dot has succeeded: the viewer's own node gets a label. */
  labelled: boolean;
  /** The page is handing itself over to Explore; nothing on this canvas moves. */
  paused: boolean;
  /** The hero is on screen. Assumed true where there is no IntersectionObserver. */
  onScreen: boolean;
  window: GraphWindow | null;
  view: GraphWindowView | null;
  /** Drift and signals: the only mutable state on this canvas. */
  field: ReturnType<typeof createField>;
  /** The viewer's node id, so the loop can hold it still while it is labelled. */
  viewerId: string | null;
  /** The cursor last written to the canvas, so it is written only on a change. */
  cursor: string;
  /**
   * Start and stop the frame loop. They close over the frame callback, so the
   * effect that builds it hands them back here for the props effects to use.
   */
  startLoop?: () => void;
  stopLoop?: () => void;
};

/**
 * The keep-out: one padded rect per content block rather than one box around
 * them all, measured off the real rendered elements so a centred headline in a
 * wide column does not claim the empty sides.
 */
function measureRects(root: HTMLElement, canvas: HTMLCanvasElement): Rect[] {
  const box = canvas.getBoundingClientRect();
  if (!box.width || !box.height) return [];
  const out: Rect[] = [];
  const push = (r: DOMRect) => {
    if (!r.width || !r.height) return;
    out.push({
      x: r.left - box.left - SAFETY,
      y: r.top - box.top - SAFETY,
      w: r.width + SAFETY * 2,
      h: r.height + SAFETY * 2,
    });
  };

  for (const el of root.querySelectorAll<HTMLElement>("[data-hero-clear]")) {
    // A text block reserves its actual lines, not the width of its box.
    if (!el.children.length && el.textContent?.trim()) {
      const range = document.createRange();
      range.selectNodeContents(el);
      const lines = range.getClientRects();
      if (lines.length) {
        for (const line of lines) push(line);
        continue;
      }
    }
    push(el.getBoundingClientRect());
  }
  return out;
}

function prefersReducedMotion() {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Every colour the frame needs, read from the `--cc-*` tokens in one pass.
 *
 * `getComputedStyle` is the expensive half, so it is called once a frame rather
 * than once a node — a 150-node window would otherwise force 150 style
 * recalculations every 16ms.
 */
type Palette = {
  line: string;
  ink: string;
  surface: string;
  node: Record<string, string>;
};

function readPalette(canvas: HTMLCanvasElement): Palette {
  const style = getComputedStyle(canvas);
  const read = (name: string) =>
    style.getPropertyValue(name).trim() || "currentColor";
  const node: Record<string, string> = {};
  // The six palette tokens plus the one every unconfigured node draws in, which
  // today is all of them.
  for (const variable of [
    ...Object.values(NODE_COLOR_VARS),
    FALLBACK_NODE_COLOR_VAR,
  ]) {
    node[variable] = read(variable);
  }
  return {
    line: read("--cc-hov"),
    ink: read("--cc-ink"),
    surface: read("--cc-surface"),
    node,
  };
}

function nodeColour(palette: Palette, colorVar: string) {
  return palette.node[colorVar] ?? palette.node[FALLBACK_NODE_COLOR_VAR];
}

/**
 * Re-derive where the window lands, for the frame as it is now.
 *
 * Called on every relayout and whenever a read answers, so the projection is
 * always a function of the current frame — which is why it can be thrown away
 * and why none of it is ever persisted.
 *
 * The field is pointed at the result rather than rebuilt from it: **reproject,
 * do not reset**. A resize keeps every node's wander and every signal's
 * progress, because the people did not change; a refetch mints new ids and so
 * clears, because different ids are different people-slots. `syncField` is
 * where both of those fall out of one rule.
 */
function refreshView(scene: Scene) {
  const measured = measureRects(scene.root, scene.canvas);
  const keepOut = measured.length ? measured : fallbackRects(scene.w, scene.h);
  scene.view = scene.window
    ? projectGraphWindow({
        window: scene.window,
        width: scene.w,
        height: scene.h,
        keepOut,
      })
    : null;
  syncField(scene.field, scene.view, keepOut, scene.w);
  scene.viewerId =
    scene.field.nodes.find((node) => node.node.isViewer)?.node.id ?? null;
}

function resize(scene: Scene) {
  const box = scene.canvas.parentElement?.getBoundingClientRect();
  if (!box) return;
  const w = Math.max(320, Math.round(box.width));
  const h = Math.max(220, Math.round(box.height));
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (w === scene.w && h === scene.h && dpr === scene.dpr) return;
  scene.w = w;
  scene.h = h;
  scene.dpr = dpr;
  scene.canvas.width = Math.round(w * dpr);
  scene.canvas.height = Math.round(h * dpr);
}

/**
 * One frame.
 *
 * Everything is drawn from the **field** rather than from the view, including
 * under reduced motion — there the field is simply never advanced, so every
 * node sits exactly on the home the projection gave it and every edge keeps the
 * clearance the projection sampled. One set of loops, one set of coordinates,
 * and no second code path that only runs on somebody else's machine.
 */
function draw(scene: Scene) {
  const { ctx, view, field } = scene;
  ctx.setTransform(scene.dpr, 0, 0, scene.dpr, 0, 0);
  ctx.clearRect(0, 0, scene.w, scene.h);
  // Nobody has joined yet, or the read has not answered. An empty community
  // draws as an empty hero: the copy reads perfectly well on `--cc-pg` alone,
  // and there is nothing here that may invent a node to fill the frame.
  if (!view) return;

  const palette = readPalette(scene.canvas);

  // The artboard's own weights: `PAL.lineA` for a backbone edge, `PAL.dotA` for
  // a node, each multiplied by how clear of the copy it landed.
  ctx.strokeStyle = palette.line;
  ctx.lineWidth = 1;
  for (const edge of field.edges) {
    if (edge.clearance <= VISIBLE) continue;
    ctx.globalAlpha = EDGE_ALPHA * edge.clearance;
    ctx.beginPath();
    ctx.moveTo(edge.from.x, edge.from.y);
    ctx.lineTo(edge.to.x, edge.to.y);
    ctx.stroke();
  }

  // Signals go under the nodes, so a trail never sits on top of the dot it
  // belongs to. Two passes rather than one interleaved loop, because a node
  // drawn after its own signal would still be drawn before the *next* node's.
  if (scene.reduced) {
    for (const node of field.nodes) {
      if (node.clearance <= VISIBLE || node.node.signalStyle === NO_SIGNAL)
        continue;
      drawSignalMark(scene, palette, node);
    }
  } else {
    for (const signal of field.signals) {
      drawSignal(scene, palette, signal);
    }
  }

  for (const node of field.nodes) {
    if (node.clearance <= VISIBLE) continue;
    ctx.globalAlpha = NODE_ALPHA * node.clearance;
    ctx.fillStyle = nodeColour(palette, node.node.colorVar);
    ctx.strokeStyle = ctx.fillStyle;
    drawNodeShape(ctx, node.x, node.y, NODE_RADIUS, node.node.style);
  }

  if (scene.labelled) {
    const you = field.nodes.find((node) => node.node.isViewer);
    // The same gate as every other mark. Their node is normally pushed clear
    // and this passes; when the copy left the push nowhere to go it does not,
    // and the reveal goes with the dot rather than being drawn over the
    // headline on its own.
    if (you && you.clearance > VISIBLE) drawYou(scene, palette, you);
  }
  ctx.globalAlpha = 1;
}

/**
 * One node's shape, at `radius`, in whatever style it carries.
 *
 * The Landing artboard has no geometry for these — its own canvas is the older
 * synthetic field, where every node is `ctx.arc(...)` and the only shapes are
 * dots. `cc-store.js` names the three styles and stops there. So the shapes are
 * defined here, and they are defined by what makes them tell apart at a
 * four-pixel radius:
 *
 * - `solid` is the filled dot, which is also what an unconfigured node draws.
 * - `ring` is the same circle stroked and left hollow, so it reads as lighter
 *   without reading as further away.
 * - `diamond` is a square on its point, sized by `DIAMOND_REACH` to hold the
 *   same visual weight as the circle.
 *
 * `ctx.fillStyle` and `ctx.strokeStyle` are the caller's: this traces and paints
 * a shape, it does not decide a colour.
 */
function drawNodeShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  style: ScreenNode["style"],
) {
  if (style === "ring") {
    ctx.lineWidth = Math.max(1, radius * 0.36);
    ctx.beginPath();
    // Inset by half the stroke so the ring occupies the same footprint as the
    // filled dot rather than spilling `lineWidth / 2` beyond it.
    ctx.arc(x, y, Math.max(0.5, radius - ctx.lineWidth / 2), 0, Math.PI * 2);
    ctx.stroke();
    return;
  }

  if (style === "diamond") {
    const reach = radius * DIAMOND_REACH;
    ctx.beginPath();
    ctx.moveTo(x, y - reach);
    ctx.lineTo(x + reach, y);
    ctx.lineTo(x, y + reach);
    ctx.lineTo(x - reach, y);
    ctx.closePath();
    ctx.fill();
    return;
  }

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * A signal in flight, in the wake its sender's `signalStyle` chose.
 *
 * `hero-signals.ts` has already decided everything: where the head is, how
 * bright it is, how far the wake runs, and what shape it is. This traces the
 * result. The one decision left here is the colour, and it is the **sending
 * node's** — the signal is theirs, so it draws in the colour their dot draws
 * in and no other.
 *
 * `signalPaint` folds the edge's clearance into every alpha it returns, so this
 * needs no clearance check of its own: a signal running under the copy arrives
 * already faded to nothing, and one under a copy the push could not clear
 * arrives at zero and is not returned at all.
 */
function drawSignal(scene: Scene, palette: Palette, signal: Signal) {
  const { ctx } = scene;
  const paint = signalPaint(scene.field, signal, { dim: scene.labelled });
  if (!paint) return;
  const colour = nodeColour(palette, paint.colorVar);

  ctx.fillStyle = colour;
  ctx.strokeStyle = colour;
  for (const disc of paint.halo) {
    ctx.globalAlpha = disc.alpha;
    ctx.beginPath();
    ctx.arc(disc.x, disc.y, disc.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  if (paint.dash) ctx.setLineDash?.(paint.dash);
  ctx.lineCap = "round";
  for (const stroke of paint.strokes) {
    ctx.globalAlpha = stroke.alpha;
    ctx.lineWidth = stroke.width;
    ctx.beginPath();
    ctx.moveTo(stroke.fromX, stroke.fromY);
    ctx.lineTo(stroke.toX, stroke.toY);
    ctx.stroke();
  }
  ctx.lineCap = "butt";
  // Every later stroke on this frame — the next signal's, an edge, the pulse
  // ring — is solid, so the pattern is cleared here rather than trusted to be
  // reset by whoever comes next.
  if (paint.dash) ctx.setLineDash?.([]);

  ctx.lineWidth = 1;
  for (const ring of paint.rings) {
    ctx.globalAlpha = ring.alpha;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/**
 * The **reduced-motion** form of a node's signal style: the same wake, standing
 * still.
 *
 * A machine that has asked for stillness gets no drift, no travelling signals
 * and no frame loop — but a member who spent their whole transcript on tier 3
 * still has to be able to see what they picked, so the style is drawn as a mark
 * around the node instead. It is the better answer than the export's, which
 * drops to two anonymous glows on two arbitrary nodes (:892-898) and shows
 * nobody their own choice.
 *
 * `comet` needs a direction, and the only one available standing still is
 * geometric: the trail points away from the middle of the frame. That is stable
 * across repaints, it costs no per-node state, and it leans every trail
 * outward — away from the hero copy, which sits in the middle — rather than
 * across it. A node exactly on the centre has no outward direction and falls
 * back to a fixed diagonal.
 *
 * The middle of the **frame**, deliberately, and not `view.centre`. Those were
 * the same point while the projection was centred on the viewport; now that
 * `pickViewportCentre` anchors the graph clear of the copy they are not, and it
 * is the frame the copy sits in the middle of. Aiming at the anchor instead
 * would point the trail of every node below it straight back through the
 * headline.
 *
 * The margins hold: the longest mark here is `comet`, at `5.4 * NODE_RADIUS` =
 * 21.6px, so it reaches at most 7.6px into a padded rect and stops about 17px
 * short of the text `SAFETY` is padding.
 */
function drawSignalMark(scene: Scene, palette: Palette, node: FieldNode) {
  const { ctx } = scene;
  const colour = nodeColour(palette, node.node.colorVar);
  const base = NODE_ALPHA * node.clearance * SIGNAL_ALPHA;
  ctx.strokeStyle = colour;

  if (node.node.signalStyle === "fade") {
    for (const ring of FADE_RINGS) {
      ctx.globalAlpha = base * ring.alpha;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(node.x, node.y, NODE_RADIUS * ring.reach, 0, Math.PI * 2);
      ctx.stroke();
    }
    return;
  }

  if (node.node.signalStyle === "dashed") {
    ctx.globalAlpha = base * DASHED_RING.alpha;
    ctx.lineWidth = DASHED_RING.width;
    ctx.setLineDash?.(DASHED_RING.dash);
    ctx.beginPath();
    ctx.arc(node.x, node.y, NODE_RADIUS * DASHED_RING.reach, 0, Math.PI * 2);
    ctx.stroke();
    // Every later stroke on this frame — the next node's, the pulse ring — is
    // solid, so the pattern is cleared here rather than trusted to be reset.
    ctx.setLineDash?.([]);
    return;
  }

  const dx = node.x - scene.w / 2;
  const dy = node.y - scene.h / 2;
  const length = Math.hypot(dx, dy);
  const ux = length > 0.5 ? dx / length : Math.SQRT1_2;
  const uy = length > 0.5 ? dy / length : -Math.SQRT1_2;
  ctx.lineCap = "round";
  for (const segment of COMET_SEGMENTS) {
    ctx.globalAlpha = base * segment.alpha;
    ctx.lineWidth = segment.width;
    ctx.beginPath();
    ctx.moveTo(
      node.x + ux * NODE_RADIUS * segment.from,
      node.y + uy * NODE_RADIUS * segment.from,
    );
    ctx.lineTo(
      node.x + ux * NODE_RADIUS * segment.to,
      node.y + uy * NODE_RADIUS * segment.to,
    );
    ctx.stroke();
  }
  ctx.lineCap = "butt";
}

/**
 * The viewer's own node, once **Find your dot** has found it: a restrained
 * pulse and a small label, no fanfare — and drawn exactly where the node
 * already was. The reveal adds a label to the graph; it does not rearrange it,
 * and the loop holds this one node still for as long as the label is up so that
 * the label is not attached to something that is wandering out from under it.
 */
function drawYou(scene: Scene, palette: Palette, you: FieldNode) {
  const { ctx } = scene;
  const x = you.x;
  const y = you.y;
  const colour = nodeColour(palette, you.node.colorVar);

  if (!scene.reduced) {
    const phase = (scene.pulse % 1.9) / 1.9;
    const ease = Math.max(0, phase * (2 - phase));
    ctx.globalAlpha = 0.34 * (1 - ease);
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(x, y, 7.5 + ease * 17, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
  ctx.fillStyle = colour;
  ctx.strokeStyle = colour;
  // The reveal enlarges the node the member already has; it does not swap it
  // for a generic dot. Somebody who chose a diamond is looking for a diamond.
  drawNodeShape(ctx, x, y, 7.5, you.node.style);
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = colour;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, 12.5, 0, Math.PI * 2);
  ctx.stroke();

  const label = "You";
  ctx.font = "600 11px Geist, system-ui, sans-serif";
  const width = ctx.measureText(label).width;
  const lx = Math.min(Math.max(x - width / 2 - 7, 6), scene.w - width - 20);
  const ly = y + 17;
  ctx.globalAlpha = 1;
  ctx.fillStyle = palette.ink;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(lx, ly, width + 14, 19, 9.5);
  else ctx.rect(lx, ly, width + 14, 19);
  ctx.fill();
  ctx.fillStyle = palette.surface;
  ctx.textBaseline = "middle";
  ctx.fillText(label, lx + 7, ly + 10);
}

/**
 * Where a pointer event landed, in canvas pixels, or `null` if the canvas has
 * no box to measure against.
 *
 * The canvas is laid out at CSS size and backed at `dpr`, so the ratio is
 * between the rendered box and `scene.w`/`scene.h` — the same conversion the
 * export does at :1428 — and not the device pixel ratio, which the transform
 * has already accounted for.
 */
function pointerPoint(
  scene: Scene,
  event: { clientX: number; clientY: number },
) {
  const box = scene.canvas.getBoundingClientRect();
  if (!box.width || !box.height) return null;
  return {
    x: ((event.clientX - box.left) * scene.w) / box.width,
    y: ((event.clientY - box.top) * scene.h) / box.height,
  };
}

type Props = {
  /**
   * The **graph window** to draw: the member's own neighbourhood, or the
   * public one. `null` only while the first read is still in flight.
   */
  window: GraphWindow | null;
  /**
   * **Find your dot** has located the viewer's node. The graph is unaffected —
   * this adds the pulse and the label, holds that one node still, and fades the
   * rest of the traffic back so the label is what the eye goes to.
   */
  labelled: boolean;
  /**
   * The landing is leaving for Explore.
   *
   * Competing motion is the biggest tell in a shared-element transition, so for
   * the length of it the only thing moving is the layout. The whole loop stops
   * here — drift, signals and pulse alike — and the scene keeps its last
   * painted frame and fades out with the rest of the hero. Clicks stop landing
   * too: a burst fired into a page that is leaving is motion nobody asked for.
   */
  paused?: boolean;
};

export function HeroNetwork({
  window: graphWindow,
  labelled,
  paused = false,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<Scene | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    // jsdom and any browser without a 2d context: the hero is decoration, so
    // its absence is a missing flourish rather than a broken page.
    if (!canvas || !ctx) return;
    const root = canvas.closest<HTMLElement>("[data-hero]") ?? canvas;

    const scene: Scene = {
      canvas,
      ctx,
      root,
      w: 0,
      h: 0,
      dpr: 1,
      raf: 0,
      reduced: prefersReducedMotion(),
      pulse: 0,
      last: 0,
      labelled: false,
      paused: false,
      onScreen: true,
      window: null,
      view: null,
      field: createField(),
      viewerId: null,
      cursor: "",
    };
    sceneRef.current = scene;
    resize(scene);
    refreshView(scene);
    draw(scene);

    /**
     * The frame loop, and its four gates.
     *
     * The scene is no longer painted on demand: nodes drift and signals travel,
     * so this runs continuously — but only while **all** of the hero being on
     * screen, the page not handing itself to Explore, the tab not hidden, and
     * motion being allowed. ADR 0006 names that trade explicitly: a loop
     * bounded by gates rather than by having nothing to draw is a weaker
     * guarantee than "painted once", and it is the price of a hero that is not
     * a background image.
     *
     * The pulse folds in rather than keeping its own bookkeeping. It advances
     * only while a label is up, so its phase is still measured from the moment
     * the label appeared and not from mount.
     */
    const tick = (ts: number) => {
      const dt = Math.max(0, Math.min(0.05, (ts - scene.last) / 1000));
      scene.last = ts;
      if (scene.labelled) scene.pulse += dt;
      advanceField(scene.field, dt, {
        holdId: scene.labelled ? scene.viewerId : null,
      });
      draw(scene);
      scene.raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      if (!scene.raf) return;
      cancelAnimationFrame(scene.raf);
      scene.raf = 0;
    };
    const start = () => {
      if (scene.raf || scene.reduced || scene.paused || !scene.onScreen) return;
      // A hidden tab has nothing to animate for, and a gate opening while one
      // is hidden must not arm a loop nothing will see.
      if (document.hidden) return;
      scene.last = performance.now();
      scene.raf = requestAnimationFrame(tick);
    };
    scene.startLoop = start;
    scene.stopLoop = stop;
    // Deliberately not started here. The `paused` and `labelled` effects below
    // run immediately after this one on mount and each ends in a `startLoop()`
    // that re-checks every gate, so arming it here as well would start a loop
    // for a hero that mounted already paused and then cancel it a tick later.

    const relayout = () => {
      resize(scene);
      refreshView(scene);
      draw(scene);
    };

    const observer =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(relayout)
        : null;
    if (observer && canvas.parentElement)
      observer.observe(canvas.parentElement);
    const onWindowResize = () => relayout();
    if (!observer) window.addEventListener("resize", onWindowResize);

    /**
     * The hero scrolling out of view stops the loop.
     *
     * This is the gate the old paint-on-demand canvas did not need and the new
     * one does: the landing page is taller than the hero, so a reader who has
     * scrolled to the sections below would otherwise be paying 60 frames a
     * second for a graph nobody can see. Where there is no `IntersectionObserver`
     * — jsdom, and browsers old enough that the rest of this page has bigger
     * problems — `onScreen` stays true and the other three gates still hold.
     */
    const watcher =
      typeof IntersectionObserver === "function"
        ? new IntersectionObserver((entries) => {
            scene.onScreen = entries.some((entry) => entry.isIntersecting);
            if (scene.onScreen) start();
            else stop();
          })
        : null;
    watcher?.observe(canvas);

    // A hidden tab has nothing to animate for. Browsers throttle rAF there, but
    // stopping outright means no work at all rather than less of it.
    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };
    document.addEventListener("visibilitychange", onVisibility);

    /**
     * Repaint when the theme changes.
     *
     * Every colour on this canvas is a `--cc-*` token resolved at draw time, so
     * the palette is an input to the frame exactly like the data and the size
     * are. The loop covers this while it is running, but every one of its four
     * gates is a state in which the scene is still on screen and still has to
     * be right — a paused hero mid-transition, a hero the reader has scrolled
     * back to, and above all a reduced-motion machine, which never runs a frame
     * at all and would otherwise keep its old colours forever.
     *
     * The root element is watched rather than `next-themes`' `resolvedTheme`,
     * and the difference is not a preference. `ThemeProvider` applies the theme
     * from a `useEffect` of its own — `setTheme` only writes state and
     * `localStorage` — and it is an ancestor of this component, so React runs
     * this child's effects first: an effect keyed on `resolvedTheme` here would
     * call `getComputedStyle` before the class it depends on had landed and
     * repaint with the palette it was trying to replace. The DOM is the honest
     * signal because it is the thing the tokens actually hang off, and watching
     * it also covers a theme changed by the OS or in another tab, neither of
     * which re-renders this component.
     *
     * Every attribute is watched rather than `class` alone. Today the theme is
     * a `.dark` class on `<html>` and `next-themes` writes `style.colorScheme`
     * in the same breath, but the design drives it with a `data-cc-theme`
     * attribute and `next-themes` defaults to `data-theme` — so a filter here
     * would be a second place that has to be edited in step with
     * `app/layout.tsx`, and forgetting would leave stale pixels rather than a
     * failing build. Root attributes change rarely enough that redrawing for
     * one is cheaper than getting the filter wrong.
     */
    const themeWatcher = new MutationObserver(() => draw(scene));
    themeWatcher.observe(document.documentElement, { attributes: true });

    /**
     * Repaint once the web font has loaded.
     *
     * The keep-out is measured off the rendered text — `getClientRects()` per
     * line — so it is measured against whatever font was in place at the time.
     * A fallback face swapping to Geist reflows those lines without necessarily
     * resizing the section, so the `ResizeObserver` need not fire and the
     * keep-out would go on protecting copy that has moved.
     *
     * `fonts.ready` cannot be cancelled, so the flag is the only teardown there
     * is: a hero unmounted during a slow font load would otherwise re-measure a
     * canvas that has already left the document and paint a scene nobody owns.
     */
    let mounted = true;
    document.fonts?.ready
      .then(() => {
        if (mounted) relayout();
      })
      .catch(() => {});

    const media =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;
    const onMedia = () => {
      scene.reduced = prefersReducedMotion();
      if (scene.reduced) stop();
      else start();
      draw(scene);
    };
    media?.addEventListener?.("change", onMedia);

    return () => {
      mounted = false;
      stop();
      themeWatcher.disconnect();
      observer?.disconnect();
      watcher?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onWindowResize);
      media?.removeEventListener?.("change", onMedia);
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.window = graphWindow;
    refreshView(scene);
    draw(scene);
  }, [graphWindow]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.paused = paused;
    // `start` re-checks every reason not to run, so this is a resume request
    // rather than an assertion that the loop should be on.
    if (paused) scene.stopLoop?.();
    else scene.startLoop?.();
  }, [paused]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.labelled = labelled;
    // The phase is measured from the label appearing, not from mount.
    if (labelled) scene.pulse = 0;
    scene.startLoop?.();
    draw(scene);
  }, [labelled]);

  /** The cursor is the only thing that advertises the dots as clickable. */
  const setCursor = (scene: Scene, want: string) => {
    if (scene.cursor === want) return;
    scene.cursor = want;
    scene.canvas.style.cursor = want;
  };

  const nodeUnder = (
    scene: Scene,
    event: { clientX: number; clientY: number },
  ) => {
    const at = pointerPoint(scene, event);
    return at ? hitTest(scene.field, at.x, at.y) : null;
  };

  return (
    <canvas
      ref={canvasRef}
      /**
       * **Deliberately hidden from assistive technology, and not an oversight.**
       *
       * A burst conveys no information, changes no state, writes no row and
       * leads nowhere; there is no equivalent to offer because there is nothing
       * to be equivalent to. Exposing it would mean up to 150 focusable dots in
       * front of the search bar — the one control on this page that everybody
       * needs — which makes the page materially worse for exactly the people
       * the exposure would be for. The export reaches the same place by
       * default: its `onVizKey` (:1452) is an empty stub. Everything this
       * canvas draws is decoration for a graph whose meaning is elsewhere, so
       * please do not "fix" this.
       */
      aria-hidden
      className="block size-full"
      data-testid="hero-network"
      onPointerMove={(event) => {
        const scene = sceneRef.current;
        if (!scene || scene.reduced || scene.paused) return;
        setCursor(scene, nodeUnder(scene, event) ? "pointer" : "");
      }}
      onPointerLeave={() => {
        const scene = sceneRef.current;
        if (scene) setCursor(scene, "");
      }}
      onPointerDown={(event) => {
        const scene = sceneRef.current;
        if (!scene || scene.reduced || scene.paused) return;
        const hit = nodeUnder(scene, event);
        // Its own node bursts like any other, and that is the best discovery
        // moment this feature has: the page has just pointed at your dot.
        if (hit) burstAt(scene.field, hit);
      }}
    />
  );
}
