"use client";

import { useEffect, useRef } from "react";
import type { GraphWindow } from "../api/queries";
import { fallbackRects, type Rect, SAFETY } from "../lib/hero-keepout";
import {
  FALLBACK_NODE_COLOR_VAR,
  type GraphWindowView,
  NO_SIGNAL,
  NODE_COLOR_VARS,
  NODE_RADIUS,
  projectGraphWindow,
  type ScreenNode,
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
 * **Node appearance is drawn, and none of it animates.** A node draws its
 * `style` as a shape and its `signalStyle` as a mark around that shape. A signal
 * is *ongoing* — `CONTEXT.md` — so it is painted on every frame a node is
 * painted, unlike the **pulse**, which is a one-shot reveal on the viewer's own
 * node and the only thing here that moves. Drawing a signal in motion would mean
 * a frame loop that never stops, which is the one property of this canvas the
 * whole design rests on; the trail is therefore rendered rather than played, and
 * the geometry below says what each style looks like standing still.
 *
 * Everything the projection derives — the scale, the anchor, the screen
 * coordinates, the keep-out push — is thrown away on the next resize. None of it
 * is ever sent back. The measuring below is what the derivation is a function
 * of: one padded rect per rendered content block, per line for a text block, so
 * a resize or a font swap re-derives rather than drifts.
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

/** How much fainter than its node a signal is drawn. */
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

  // Signals go under the nodes, so a trail never sits on top of the dot it
  // belongs to. Two passes rather than one interleaved loop, because a node
  // drawn after its own signal would still be drawn before the *next* node's.
  for (const node of view.nodes) {
    if (node.clearance <= 0.02 || node.signalStyle === NO_SIGNAL) continue;
    drawSignal(scene, palette, node);
  }

  for (const node of view.nodes) {
    if (node.clearance <= 0.02) continue;
    ctx.globalAlpha = NODE_ALPHA * node.clearance;
    ctx.fillStyle = nodeColour(palette, node.colorVar);
    ctx.strokeStyle = ctx.fillStyle;
    drawNodeShape(ctx, node.screenX, node.screenY, NODE_RADIUS, node.style);
  }

  if (scene.labelled) {
    const you = view.nodes.find((node) => node.isViewer);
    if (you) drawYou(scene, palette, you);
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
 * The signal a node carries, drawn standing still.
 *
 * **It does not move, and that is deliberate.** A signal is ongoing rather than
 * one-shot, so it is painted every time its node is painted — but this canvas
 * paints on demand, and a signal that animated would mean a frame loop running
 * for as long as anybody has the landing page open. `hero-network.spec.tsx` is
 * written as the checklist of what triggers a repaint precisely because there is
 * no such loop, and the pulse on the viewer's own node remains the only motion
 * here.
 *
 * `comet` needs a direction, and the only one available is geometric: the trail
 * points away from the middle of the frame. That is stable across repaints, it
 * costs no per-node state, and it leans every trail outward — away from the hero
 * copy, which sits in the middle — rather than across it. A node exactly on the
 * centre has no outward direction and falls back to a fixed diagonal.
 *
 * The middle of the **frame**, deliberately, and no longer `view.centre`. Those
 * were the same point while the projection was centred on the viewport; now that
 * `pickViewportCentre` anchors the graph clear of the copy they are not, and it
 * is the frame the copy sits in the middle of. Aiming at the anchor instead
 * would point the trail of every node below it straight back through the
 * headline. `pushClear` rotates a trail as it moves the node it belongs to,
 * which is right for the same reason: it points away from where the node ended
 * up rather than from where the projection first put it.
 *
 * One knock-on from the push worth naming: `clearance` is 1 for every node the
 * push placed, so a signal beside the copy is drawn at full strength where it
 * used to be dimmed towards nothing. That is the fix working rather than a
 * regression — the copy is protected by 14px of distance now instead of by
 * dimness — and the margins hold: the longest mark here is `comet`, at
 * `5.4 * NODE_RADIUS` = 21.6px, so it reaches at most 7.6px into a padded rect
 * and stops about 17px short of the text `SAFETY` is padding.
 */
function drawSignal(scene: Scene, palette: Palette, node: ScreenNode) {
  const { ctx } = scene;
  const colour = nodeColour(palette, node.colorVar);
  const base = NODE_ALPHA * node.clearance * SIGNAL_ALPHA;
  ctx.strokeStyle = colour;

  if (node.signalStyle === "fade") {
    for (const ring of FADE_RINGS) {
      ctx.globalAlpha = base * ring.alpha;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(
        node.screenX,
        node.screenY,
        NODE_RADIUS * ring.reach,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
    return;
  }

  if (node.signalStyle === "dashed") {
    ctx.globalAlpha = base * DASHED_RING.alpha;
    ctx.lineWidth = DASHED_RING.width;
    ctx.setLineDash?.(DASHED_RING.dash);
    ctx.beginPath();
    ctx.arc(
      node.screenX,
      node.screenY,
      NODE_RADIUS * DASHED_RING.reach,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
    // Every later stroke on this frame — the next node's, the pulse ring — is
    // solid, so the pattern is cleared here rather than trusted to be reset.
    ctx.setLineDash?.([]);
    return;
  }

  const dx = node.screenX - scene.w / 2;
  const dy = node.screenY - scene.h / 2;
  const length = Math.hypot(dx, dy);
  const ux = length > 0.5 ? dx / length : Math.SQRT1_2;
  const uy = length > 0.5 ? dy / length : -Math.SQRT1_2;
  ctx.lineCap = "round";
  for (const segment of COMET_SEGMENTS) {
    ctx.globalAlpha = base * segment.alpha;
    ctx.lineWidth = segment.width;
    ctx.beginPath();
    ctx.moveTo(
      node.screenX + ux * NODE_RADIUS * segment.from,
      node.screenY + uy * NODE_RADIUS * segment.from,
    );
    ctx.lineTo(
      node.screenX + ux * NODE_RADIUS * segment.to,
      node.screenY + uy * NODE_RADIUS * segment.to,
    );
    ctx.stroke();
  }
  ctx.lineCap = "butt";
}

/**
 * The viewer's own node, once **Find your dot** has found it: a restrained
 * pulse and a small label, no fanfare — and drawn exactly where the node
 * already was. The reveal adds a label to the graph; it does not rearrange it.
 */
function drawYou(scene: Scene, palette: Palette, you: ScreenNode) {
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
  ctx.strokeStyle = colour;
  // The reveal enlarges the node the member already has; it does not swap it
  // for a generic dot. Somebody who chose a diamond is looking for a diamond.
  drawNodeShape(ctx, x, y, 7.5, you.style);
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
  /**
   * The landing is leaving for Explore.
   *
   * Competing motion is the biggest tell in a shared-element transition, so for
   * the length of it the only thing moving is the layout. The pulse is the only
   * animation this canvas ever runs, and it stops here — the scene keeps its
   * last painted frame and fades out with the rest of the hero.
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
      if (scene.raf || !scene.labelled || scene.reduced || scene.paused) return;
      // A hidden tab has nothing to animate for, and the label appearing while
      // one is hidden must not arm a loop nothing will see.
      if (document.hidden) return;
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

    /**
     * Repaint when the theme changes.
     *
     * Every colour on this canvas is a `--cc-*` token resolved at draw time, so
     * the palette is an input to the frame exactly like the data and the size
     * are. Pixels already rasterised do not re-resolve a custom property, and
     * the scene is otherwise painted once and left alone, so without this the
     * graph keeps its old colours until something else happens to redraw it.
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
     * failing build. Root attributes change rarely enough that redrawing a
     * still scene for one is cheaper than getting the filter wrong.
     */
    const themeWatcher = new MutationObserver(() => draw(scene));
    themeWatcher.observe(document.documentElement, { attributes: true });

    /**
     * Repaint once the web font has loaded.
     *
     * The keep-out is measured off the rendered text — `getClientRects()` per
     * line — so it is measured against whatever font was in place at the time.
     * A fallback face swapping to Geist reflows those lines without necessarily
     * resizing the section, so the `ResizeObserver` need not fire and the fade
     * would go on protecting copy that has moved.
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
    // rather than an assertion that the pulse should be on.
    if (paused) scene.stopPulse?.();
    else scene.startPulse?.();
  }, [paused]);

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
