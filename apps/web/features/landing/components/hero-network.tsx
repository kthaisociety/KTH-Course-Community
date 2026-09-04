"use client";

import { useEffect, useRef } from "react";
import type { Neighbourhood } from "../api/queries";
import {
  buildField,
  clearAt,
  DRIFT_BOX,
  envelope,
  type Field,
  type FieldEdge,
  type FieldNode,
  fallbackRects,
  INSET,
  lineClearance,
  quadPoint,
  type Rect,
  SAFETY,
} from "../lib/hero-field";
import {
  FALLBACK_NODE_COLOR_VAR,
  type NeighbourhoodView,
  NODE_COLOR_VARS,
  projectNeighbourhood,
} from "../lib/neighbourhood-view";

/**
 * The network behind the hero copy.
 *
 * It draws one of two things, and the difference matters:
 *
 * - **Ambient** — a decorative field of drifting dots. It is an illustration of
 *   a community, not the community: no dot carries an account, none is ever
 *   labelled, and nothing about it comes from the database.
 * - **Revealed** — the caller's real bounded neighbourhood, projected from the
 *   stored world positions. Their own node is marked "You".
 *
 * The revealed graph is still: real world positions must not appear to wander,
 * and its lines carry no travelling signals because a **backbone edge records
 * placement history and is not a friendship** — animating a recommendation
 * along one would give it a social meaning the data does not have.
 *
 * Everything the projection derives — the scale, the centre, the screen
 * coordinates — is thrown away on the next resize. None of it is ever sent back.
 */

/**
 * How many dots the ambient field draws inside the frame.
 *
 * A phone gets a much sparser field, as the design's own Mobile Preview does —
 * it embeds this page with `account-count="14"` against the desktop default.
 */
const AMBIENT_COUNT = 50;
const AMBIENT_COUNT_NARROW = 14;
const NARROW_WIDTH = 500;

function ambientCount(width: number) {
  return width < NARROW_WIDTH ? AMBIENT_COUNT_NARROW : AMBIENT_COUNT;
}

type Signal = {
  edge: FieldEdge;
  from: FieldNode;
  to: FieldNode;
  ax: number;
  ay: number;
  bx: number;
  by: number;
  cx: number;
  cy: number;
  headX: number;
  headY: number;
  len: number;
  p: number;
  dur: number;
  prominence: number;
};

type Scene = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  root: HTMLElement;
  w: number;
  h: number;
  dpr: number;
  rects: Rect[];
  field: Field;
  signals: Signal[];
  spawnAt: number;
  last: number;
  raf: number;
  reduced: boolean;
  clearCursor: number;
  /** 0 ambient, 1 the real graph — eased so the swap is not a jump cut. */
  reveal: number;
  pulse: number;
  neighbourhood: Neighbourhood | null;
  view: NeighbourhoodView | null;
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
 * than once a node — a 150-node neighbourhood would otherwise force 150 style
 * recalculations every 16ms.
 */
type Palette = {
  line: string;
  dot: string;
  ink: string;
  surface: string;
  node: Record<string, string>;
};

function readPalette(canvas: HTMLCanvasElement): Palette {
  const style = getComputedStyle(canvas);
  const read = (name: string) =>
    style.getPropertyValue(name).trim() || "currentColor";
  const node: Record<string, string> = {};
  for (const variable of Object.values(NODE_COLOR_VARS)) {
    node[variable] = read(variable);
  }
  return {
    line: read("--cc-hov"),
    dot: read("--cc-brand"),
    ink: read("--cc-ink"),
    surface: read("--cc-surface"),
    node,
  };
}

function layout(scene: Scene) {
  scene.rects = measureRects(scene.root, scene.canvas);
  if (!scene.rects.length) scene.rects = fallbackRects(scene.w, scene.h);
  scene.field = buildField({
    w: scene.w,
    h: scene.h,
    rects: scene.rects,
    count: ambientCount(scene.w),
  });
  scene.signals = [];
  scene.clearCursor = 0;
  refreshView(scene);
}

/**
 * Re-derive where the real neighbourhood lands, for the frame as it is now.
 *
 * Called on every relayout and whenever the read answers, so the projection is
 * always a function of the current frame — which is why it can be thrown away
 * and why none of it is ever persisted.
 */
function refreshView(scene: Scene) {
  scene.view = scene.neighbourhood
    ? projectNeighbourhood({
        neighbourhood: scene.neighbourhood,
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
  layout(scene);
}

function spawnSignal(scene: Scene) {
  const edges = scene.field.edges;
  if (!edges.length) return;
  for (let attempt = 0; attempt < 14; attempt++) {
    const edge = edges[Math.floor(Math.random() * edges.length)];
    if (scene.signals.some((s) => s.edge === edge)) continue;
    const from = Math.random() < 0.5 ? edge.a : edge.b;
    const to = from === edge.a ? edge.b : edge.a;
    const len = Math.max(1, Math.hypot(to.x - from.x, to.y - from.y));
    scene.signals.push({
      edge,
      from,
      to,
      ax: from.x,
      ay: from.y,
      bx: to.x,
      by: to.y,
      cx: (from.x + to.x) / 2,
      cy: (from.y + to.y) / 2,
      headX: from.x,
      headY: from.y,
      len,
      p: 0,
      // A constant pace, whatever the length of the line.
      dur: Math.max(2.6, len / (26 + Math.random() * 22)),
      prominence: 0.72 + Math.random() * 0.28,
    });
    return;
  }
}

function drift(scene: Scene, dt: number) {
  const { field, w, h, rects } = scene;
  for (const n of field.nodes) {
    n.x += n.vx * dt;
    n.y += n.vy * dt;
    if (n.x < n.hx - DRIFT_BOX) {
      n.x = n.hx - DRIFT_BOX;
      n.vx = Math.abs(n.vx);
    }
    if (n.x > n.hx + DRIFT_BOX) {
      n.x = n.hx + DRIFT_BOX;
      n.vx = -Math.abs(n.vx);
    }
    if (n.y < n.hy - DRIFT_BOX) {
      n.y = n.hy - DRIFT_BOX;
      n.vy = Math.abs(n.vy);
    }
    if (n.y > n.hy + DRIFT_BOX) {
      n.y = n.hy + DRIFT_BOX;
      n.vy = -Math.abs(n.vy);
    }
    // Drawn dots stay on screen and off the copy; off-frame nodes stay off it.
    if (!n.offFrame) {
      if (n.x < INSET) {
        n.x = INSET;
        n.vx = Math.abs(n.vx);
      }
      if (n.x > w - INSET) {
        n.x = w - INSET;
        n.vx = -Math.abs(n.vx);
      }
      if (n.y < INSET) {
        n.y = INSET;
        n.vy = Math.abs(n.vy);
      }
      if (n.y > h - INSET) {
        n.y = h - INSET;
        n.vy = -Math.abs(n.vy);
      }
      if (clearAt(n.x, n.y, rects, n.r + 1) < 1) {
        n.x -= n.vx * dt * 2;
        n.y -= n.vy * dt * 2;
        n.vx = -n.vx;
        n.vy = -n.vy;
      }
    }
  }
}

function drawAmbient(scene: Scene, palette: Palette, alpha: number) {
  const { ctx, field, rects } = scene;

  // Clearance barely moves — drift is clamped to a few px — so it is cached and
  // refreshed on a rolling slice rather than recomputed for every line, every
  // frame. Four alpha buckets let the whole field draw in four strokes.
  const edges = field.edges;
  if (edges.length) {
    const slice = Math.max(1, Math.ceil(edges.length / 30));
    for (let i = 0; i < slice; i++) {
      const edge = edges[(scene.clearCursor + i) % edges.length];
      edge.clear = lineClearance(edge.a, edge.b, rects);
    }
    scene.clearCursor = (scene.clearCursor + slice) % edges.length;
  }

  const buckets: FieldEdge[][] = [[], [], [], []];
  for (const edge of edges) {
    const clear = edge.clear ?? lineClearance(edge.a, edge.b, rects);
    if (clear <= 0.02) continue;
    buckets[Math.min(3, Math.floor(clear * 4 - 0.0001))].push(edge);
  }
  ctx.lineWidth = 1;
  ctx.strokeStyle = palette.line;
  for (let bucket = 0; bucket < buckets.length; bucket++) {
    if (!buckets[bucket].length) continue;
    ctx.globalAlpha = alpha * 0.26 * ((bucket + 1) / 4);
    ctx.beginPath();
    for (const edge of buckets[bucket]) {
      ctx.moveTo(edge.a.x, edge.a.y);
      ctx.lineTo(edge.b.x, edge.b.y);
    }
    ctx.stroke();
  }

  ctx.fillStyle = palette.dot;
  for (const node of field.nodes) {
    if (node.offFrame) continue;
    ctx.globalAlpha = alpha * 0.82 * clearAt(node.x, node.y, rects);
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawSignals(
  scene: Scene,
  palette: Palette,
  dt: number,
  ts: number,
  alpha: number,
) {
  const { ctx, field } = scene;
  if (ts > scene.spawnAt && scene.signals.length < field.maxSignals) {
    spawnSignal(scene);
    scene.spawnAt = ts + 260 + Math.random() * 900;
  }

  for (let i = scene.signals.length - 1; i >= 0; i--) {
    const s = scene.signals[i];
    s.p += dt / s.dur;
    if (s.p >= 1) {
      scene.signals.splice(i, 1);
      continue;
    }
    // The ends follow their dots, so the flash still lands on one.
    s.ax = s.from.x;
    s.ay = s.from.y;
    s.bx = s.to.x;
    s.by = s.to.y;
    s.cx = (s.ax + s.bx) / 2;
    s.cy = (s.ay + s.by) / 2;
    s.len = Math.max(1, Math.hypot(s.bx - s.ax, s.by - s.ay));
    const head = quadPoint(s, s.p);
    s.headX = head.x;
    s.headY = head.y;

    const k = Math.min(1, envelope(s.p) * s.prominence) * alpha;
    if (k <= 0.002) continue;
    const tail = quadPoint(s, s.p - Math.min(s.p, (16 + 74 * k) / s.len));

    const grad = ctx.createLinearGradient(tail.x, tail.y, s.headX, s.headY);
    grad.addColorStop(0, "transparent");
    grad.addColorStop(0.9, palette.dot);
    grad.addColorStop(1, palette.ink);
    ctx.globalAlpha = k;
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.1 + 1.9 * k;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(tail.x, tail.y);
    ctx.lineTo(s.headX, s.headY);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** Motion off: two dots hold a steady glow instead of anything travelling. */
function drawGlows(scene: Scene, palette: Palette, alpha: number) {
  const { ctx, field } = scene;
  for (const node of field.glows) {
    ctx.globalAlpha = alpha * 0.7;
    ctx.fillStyle = palette.dot;
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.r + 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawNeighbourhood(scene: Scene, palette: Palette, alpha: number) {
  const { ctx, view } = scene;
  if (!view) return;

  ctx.strokeStyle = palette.line;
  ctx.lineWidth = 1;
  for (const [from, to] of view.edges) {
    ctx.globalAlpha = alpha * 0.3 * Math.min(from.clearance, to.clearance);
    ctx.beginPath();
    ctx.moveTo(from.screenX, from.screenY);
    ctx.lineTo(to.screenX, to.screenY);
    ctx.stroke();
  }

  for (const node of view.nodes) {
    if (node.isViewer) continue;
    ctx.globalAlpha = alpha * 0.85 * node.clearance;
    ctx.fillStyle =
      palette.node[node.colorVar] ?? palette.node[FALLBACK_NODE_COLOR_VAR];
    ctx.beginPath();
    ctx.arc(node.screenX, node.screenY, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  const you = view.nodes.find((n) => n.isViewer);
  if (you) drawYou(scene, palette, you, alpha);
  ctx.globalAlpha = 1;
}

/** The caller's own node: a restrained pulse and a small label, no fanfare. */
function drawYou(
  scene: Scene,
  palette: Palette,
  you: { screenX: number; screenY: number; colorVar: string },
  alpha: number,
) {
  const { ctx } = scene;
  const x = you.screenX;
  const y = you.screenY;
  const colour =
    palette.node[you.colorVar] ?? palette.node[FALLBACK_NODE_COLOR_VAR];

  if (!scene.reduced) {
    const phase = (scene.pulse % 1.9) / 1.9;
    const ease = Math.max(0, phase * (2 - phase));
    ctx.globalAlpha = alpha * 0.34 * (1 - ease);
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(x, y, 7.5 + ease * 17, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.globalAlpha = alpha;
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(x, y, 7.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = alpha * 0.5;
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
  ctx.globalAlpha = alpha;
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
   * The caller's own neighbourhood, once `graph.neighbourhood` has answered.
   * `null` while they are a visitor, unplaced, or simply have not asked.
   */
  neighbourhood: Neighbourhood | null;
};

export function HeroNetwork({ neighbourhood }: Props) {
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
      field: {
        nodes: [],
        edges: [],
        byNode: new Map(),
        glows: [],
        minGap: 0,
        maxSignals: 3,
        marginX: 0,
        marginY: 0,
      },
      signals: [],
      spawnAt: 0,
      last: 0,
      raf: 0,
      reduced: prefersReducedMotion(),
      clearCursor: 0,
      reveal: 0,
      pulse: 0,
      neighbourhood: null,
      view: null,
    };
    sceneRef.current = scene;
    resize(scene);

    const tick = (ts: number) => {
      const dt = Math.max(0, Math.min(0.05, (ts - scene.last) / 1000 || 0.016));
      scene.last = ts;
      scene.pulse += dt;

      const want = scene.view ? 1 : 0;
      scene.reveal +=
        (want - scene.reveal) * (scene.reduced ? 1 : Math.min(1, dt / 0.45));

      ctx.setTransform(scene.dpr, 0, 0, scene.dpr, 0, 0);
      ctx.clearRect(0, 0, scene.w, scene.h);

      const palette = readPalette(canvas);
      const ambient = 1 - scene.reveal;
      if (ambient > 0.01) {
        if (!scene.reduced) drift(scene, dt);
        drawAmbient(scene, palette, ambient);
        if (scene.reduced) drawGlows(scene, palette, ambient);
        else drawSignals(scene, palette, dt, ts, ambient);
      }
      if (scene.reveal > 0.01) drawNeighbourhood(scene, palette, scene.reveal);

      scene.raf = requestAnimationFrame(tick);
    };

    const observer =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(() => resize(scene))
        : null;
    if (observer && canvas.parentElement)
      observer.observe(canvas.parentElement);
    const onWindowResize = () => resize(scene);
    if (!observer) window.addEventListener("resize", onWindowResize);

    // A hidden tab has nothing to animate for. Browsers throttle rAF there, but
    // stopping outright means no work at all rather than less of it.
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(scene.raf);
        scene.raf = 0;
      } else if (!scene.raf) {
        scene.last = performance.now();
        scene.raf = requestAnimationFrame(tick);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const media =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;
    const onMedia = () => {
      scene.reduced = prefersReducedMotion();
      layout(scene);
    };
    media?.addEventListener?.("change", onMedia);

    scene.last = performance.now();
    scene.spawnAt = scene.last + 500;
    scene.raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(scene.raf);
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
    scene.neighbourhood = neighbourhood;
    refreshView(scene);
  }, [neighbourhood]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="block size-full"
      data-testid="hero-network"
    />
  );
}
