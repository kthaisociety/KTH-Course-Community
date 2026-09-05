"use client";

import { useEffect, useRef } from "react";
import type { GraphWindow } from "../api/queries";
import { fallbackRects, type Rect, SAFETY } from "../lib/hero-keepout";
import {
  FALLBACK_NODE_COLOR_VAR,
  type GraphWindowView,
  NODE_COLOR_VARS,
  NODE_RADIUS,
  projectGraphWindow,
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
 * - a member sees their own neighbourhood, centred on their own node;
 * - a visitor sees a window centred on the community origin, with no "You".
 *
 * **Find your dot** no longer swaps anything. The graph is already on screen;
 * the flow only labels the viewer's own node, and the reveal is the pulse and
 * the label appearing. Nothing else changes, which is also what the artboard
 * does: "the graph never moves: the dot grows and pulses in place".
 *
 * The graph is still. Real world positions must not appear to wander, and no
 * signal travels along a line, because a **backbone edge records placement
 * history and is not a friendship** — animating a recommendation along one
 * would give it a social meaning the data does not have. The only motion on
 * this canvas is the pulse on the labelled node, so the frame loop runs only
 * while that pulse is on screen and the scene is otherwise drawn once.
 *
 * Everything the projection derives — the scale, the centre, the screen
 * coordinates — is thrown away on the next resize. None of it is ever sent back.
 */

/** `PAL.dotA` and `PAL.lineA` from the Landing artboard's palette. */
const NODE_ALPHA = 0.82;
const EDGE_ALPHA = 0.26;

type Scene = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  root: HTMLElement;
  w: number;
  h: number;
  dpr: number;
  rects: Rect[];
  raf: number;
  reduced: boolean;
  /** Seconds the pulse has been running, and only ever while it is running. */
  pulse: number;
  last: number;
  /** Find your dot has succeeded: the viewer's own node gets a label. */
  labelled: boolean;
  window: GraphWindow | null;
  view: GraphWindowView | null;
  /**
   * Start and stop the pulse loop. They close over the frame callback, so the
   * effect that builds it hands them back here for the props effects to use.
   */
  startPulse?: () => void;
  stopPulse?: () => void;
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
 */
function refreshView(scene: Scene) {
  scene.rects = measureRects(scene.root, scene.canvas);
  if (!scene.rects.length) scene.rects = fallbackRects(scene.w, scene.h);
  scene.view = scene.window
    ? projectGraphWindow({
        window: scene.window,
        width: scene.w,
        height: scene.h,
        keepOut: scene.rects,
      })
    : null;
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

function draw(scene: Scene) {
  const { ctx, view } = scene;
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
  for (const edge of view.edges) {
    if (edge.clearance <= 0.02) continue;
    ctx.globalAlpha = EDGE_ALPHA * edge.clearance;
    ctx.beginPath();
    ctx.moveTo(edge.from.screenX, edge.from.screenY);
    ctx.lineTo(edge.to.screenX, edge.to.screenY);
    ctx.stroke();
  }

  for (const node of view.nodes) {
    if (node.clearance <= 0.02) continue;
    ctx.globalAlpha = NODE_ALPHA * node.clearance;
    ctx.fillStyle = nodeColour(palette, node.colorVar);
    ctx.beginPath();
    ctx.arc(node.screenX, node.screenY, NODE_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }

  if (scene.labelled) {
    const you = view.nodes.find((node) => node.isViewer);
    if (you) drawYou(scene, palette, you);
  }
  ctx.globalAlpha = 1;
}

/**
 * The viewer's own node, once **Find your dot** has found it: a restrained
 * pulse and a small label, no fanfare — and drawn exactly where the node
 * already was. The reveal adds a label to the graph; it does not rearrange it.
 */
function drawYou(
  scene: Scene,
  palette: Palette,
  you: { screenX: number; screenY: number; colorVar: string },
) {
  const { ctx } = scene;
  const x = you.screenX;
  const y = you.screenY;
  const colour = nodeColour(palette, you.colorVar);

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
  ctx.beginPath();
  ctx.arc(x, y, 7.5, 0, Math.PI * 2);
  ctx.fill();
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

type Props = {
  /**
   * The bounded window to draw: the member's own neighbourhood, or the public
   * one. `null` only while the first read is still in flight.
   */
  window: GraphWindow | null;
  /**
   * **Find your dot** has located the viewer's node. The graph is unaffected —
   * this adds the pulse and the label and nothing else.
   */
  labelled: boolean;
};

export function HeroNetwork({ window: graphWindow, labelled }: Props) {
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
      rects: [],
      raf: 0,
      reduced: prefersReducedMotion(),
      pulse: 0,
      last: 0,
      labelled: false,
      window: null,
      view: null,
    };
    sceneRef.current = scene;
    resize(scene);
    refreshView(scene);
    draw(scene);

    /**
     * The pulse, and only the pulse.
     *
     * A graph of stored positions does not move, so there is nothing to animate
     * until a node is labelled: the scene is painted once and left alone. This
     * loop starts when the label appears and stops when it goes, rather than
     * burning a frame every 16ms to redraw an identical picture.
     */
    const tick = (ts: number) => {
      scene.pulse += Math.max(0, Math.min(0.05, (ts - scene.last) / 1000));
      scene.last = ts;
      draw(scene);
      scene.raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      if (!scene.raf) return;
      cancelAnimationFrame(scene.raf);
      scene.raf = 0;
    };
    const start = () => {
      if (scene.raf || !scene.labelled || scene.reduced) return;
      scene.last = performance.now();
      scene.raf = requestAnimationFrame(tick);
    };
    scene.startPulse = start;
    scene.stopPulse = stop;

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

    // A hidden tab has nothing to animate for. Browsers throttle rAF there, but
    // stopping outright means no work at all rather than less of it.
    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };
    document.addEventListener("visibilitychange", onVisibility);

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
      stop();
      observer?.disconnect();
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
    scene.labelled = labelled;
    if (labelled) {
      scene.pulse = 0;
      scene.startPulse?.();
    } else {
      scene.stopPulse?.();
    }
    draw(scene);
  }, [labelled]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="block size-full"
      data-testid="hero-network"
    />
  );
}
