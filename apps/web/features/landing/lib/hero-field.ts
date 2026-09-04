/**
 * The hero's ambient field: the drifting dots behind the landing copy.
 *
 * This is an **illustration of a community, never the community**. Nothing here
 * reads a world position, and no dot it produces is ever labelled with an
 * account — the real graph arrives separately, through `graph.neighbourhood`,
 * and `neighbourhood-view.ts` projects that. Keeping the two apart is the whole
 * point of the split: a decorative dot must never be mistaken for a Node.
 *
 * Nothing here touches the DOM, a canvas or a clock, so every placement
 * decision can be asserted on directly. `hero-network.tsx` owns the canvas, the
 * rAF loop and the measuring; it calls in here for *where* things go.
 *
 * The one rule the file exists to enforce: no dot and no line between two dots
 * may sit on top of the hero copy.
 */

/** A measured content box the field must keep clear of, in canvas pixels. */
export type Rect = { x: number; y: number; w: number; h: number };

export type FieldNode = {
  seed: number;
  /** Live position. */
  x: number;
  y: number;
  /** Home position — drift is clamped to a small box around it. */
  hx: number;
  hy: number;
  r: number;
  /**
   * An off-frame node. Lines and signals travel through it so the field reads
   * as a crop of something larger, and it is never drawn.
   *
   * Deliberately not called an anchor: an **Anchor** is an established node a
   * joining node attaches to in the community graph, and this is a decoration.
   */
  offFrame: boolean;
  /** How many lines this dot will accept. */
  quota: number;
  vx: number;
  vy: number;
};

export type FieldEdge = {
  a: FieldNode;
  b: FieldNode;
  /** Cached clearance, refreshed on a rolling slice rather than every frame. */
  clear?: number;
};

export type Field = {
  nodes: FieldNode[];
  edges: FieldEdge[];
  byNode: Map<FieldNode, FieldEdge[]>;
  /** Two resting dots, glowing in place when motion is off. */
  glows: FieldNode[];
  minGap: number;
  maxSignals: number;
  /** How far the virtual canvas extends past the frame, per axis. */
  marginX: number;
  marginY: number;
};

/** Width of the soft margin around the copy, in px. */
export const FEATHER = 10;
/** Extra padding added to every measured content rect, in px. */
export const SAFETY = 25;
/** Drawn dots stay this far inside the frame; off-frame nodes stay outside it. */
export const INSET = 20;
/** How far a dot may drift from its home position, in px. */
export const DRIFT_BOX = 5;

/** Halton — a low-discrepancy sequence: evenly spread without rows or clumps. */
export function halton(index: number, base: number) {
  let f = 1;
  let r = 0;
  let n = index + 1;
  while (n > 0) {
    f /= base;
    r += f * (n % base);
    n = Math.floor(n / base);
  }
  return r;
}

/** Deterministic per-dot jitter, so a relayout reproduces the same field. */
export function hash(index: number, salt: number) {
  const x = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * 1 well clear of the hero copy, easing to 0 inside it. `radius` grows the
 * point into a disc, so a dot is judged by its edge rather than its centre.
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

/** Distance from the content keep-out, in px. 0 when inside it. */
export function distToContent(x: number, y: number, rects: Rect[]) {
  let m = Number.POSITIVE_INFINITY;
  for (const r of rects) {
    const dx = Math.max(r.x - x, 0, x - (r.x + r.w));
    const dy = Math.max(r.y - y, 0, y - (r.y + r.h));
    m = Math.min(m, Math.hypot(dx, dy));
  }
  return m;
}

/** Thinner near the copy, full density further out — the field stays legible. */
export function densityAt(x: number, y: number, rects: Rect[]) {
  const t = Math.min(1, distToContent(x, y, rects) / 300);
  return 0.16 + 0.84 * t * t;
}

/** Sampled clearance along a line — 1 well clear of the copy, 0 crossing it. */
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

export function lineClear(
  a: { x: number; y: number },
  b: { x: number; y: number },
  rects: Rect[],
) {
  return lineClearance(a, b, rects) >= 1;
}

/** Faint on departure, defined mid-flight, gone on arrival. */
export function envelope(p: number) {
  const smoothstep = (a: number, b: number, x: number) => {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  return Math.min(smoothstep(0.03, 0.42, p) ** 1.5, 1 - smoothstep(0.86, 1, p));
}

/** A point along a signal's quadratic path. */
export function quadPoint(
  s: { ax: number; ay: number; cx: number; cy: number; bx: number; by: number },
  p: number,
) {
  const q = 1 - p;
  return {
    x: q * q * s.ax + 2 * q * p * s.cx + p * p * s.bx,
    y: q * q * s.ay + 2 * q * p * s.cy + p * p * s.by,
  };
}

/** `rgb(...)` triple plus alpha, for a canvas fill or stroke. */
export function rgba(colour: readonly number[], alpha: number) {
  const [r, g, b] = colour;
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${Math.max(0, alpha).toFixed(3)})`;
}

/** Keep-out used when the hero's own elements cannot be measured. */
export function fallbackRects(w: number, h: number): Rect[] {
  const copy = Math.min(780, w * 0.74);
  return [
    { x: w / 2 - copy / 2, y: 10, w: copy, h: h * 0.5 },
    { x: w / 2 - copy * 0.45, y: h * 0.5, w: copy * 0.9, h: h * 0.3 },
  ];
}

export function makeFieldNode(
  seed: number,
  x: number,
  y: number,
  offFrame: boolean,
): FieldNode {
  const dir = hash(seed, 1) * 6.2832;
  const speed = 1.8 + hash(seed, 2) * 0.4;
  return {
    seed,
    x,
    y,
    hx: x,
    hy: y,
    r: 4,
    offFrame,
    quota: 3 + (hash(seed, 3) < 0.55 ? 1 : 0) + (hash(seed, 4) < 0.28 ? 1 : 0),
    vx: Math.cos(dir) * speed,
    vy: Math.sin(dir) * speed,
  };
}

export type FieldInput = {
  w: number;
  h: number;
  rects: Rect[];
  /** How many dots to draw inside the frame. */
  count: number;
};

/**
 * Place the field and wire it up.
 *
 * The field lives on a virtual canvas larger than the hero on every side, so
 * the screen reads as a crop of something bigger: lines cross the frame edges
 * into off-frame nodes that are never drawn.
 */
export function buildField({ w, h, rects, count }: FieldInput): Field {
  const marginX = Math.max(140, Math.round(w * 0.26));
  const marginY = Math.max(130, Math.round(h * 0.45));
  const onArea = Math.max(1, (w - INSET * 2) * (h - INSET * 2));
  const target = Math.max(1, count);
  const gap = Math.sqrt(onArea / target) * 0.62;
  const nodes: FieldNode[] = [];

  let p = 0;
  for (let seed = 0; seed < target; seed++) {
    let placed: FieldNode | null = null;
    for (; p < 30000 && !placed; p++) {
      const x = INSET + halton(p, 2) * (w - INSET * 2);
      const y = INSET + halton(p, 3) * (h - INSET * 2);
      if (clearAt(x, y, rects, 5) < 1) continue;
      if (hash(p, 7) > densityAt(x, y, rects)) continue; // thin out near the copy
      if (nodes.some((n) => Math.hypot(n.x - x, n.y - y) < gap)) continue;
      placed = makeFieldNode(seed, x, y, false);
    }
    if (!placed) break; // this frame has no room left
    nodes.push(placed);
  }

  const offFrameCount = Math.min(140, Math.round(target * 0.55));
  for (
    let i = 0, added = 0;
    added < offFrameCount && i < offFrameCount * 30;
    i++
  ) {
    const x = -marginX + halton(i + 977, 2) * (w + marginX * 2);
    const y = -marginY + halton(i + 977, 3) * (h + marginY * 2);
    if (x > INSET && x < w - INSET && y > INSET && y < h - INSET) continue;
    if (nodes.some((n) => Math.hypot(n.x - x, n.y - y) < gap * 0.8)) continue;
    nodes.push(makeFieldNode(i + 977, x, y, true));
    added++;
  }

  const edges = buildFieldEdges(nodes, w, h, rects);
  const byNode = new Map<FieldNode, FieldEdge[]>();
  for (const n of nodes) byNode.set(n, []);
  for (const edge of edges) {
    byNode.get(edge.a)?.push(edge);
    byNode.get(edge.b)?.push(edge);
  }

  const still = nodes
    .filter((n) => !n.offFrame && clearAt(n.x, n.y, rects) > 0.9)
    .sort((a, b) => b.y - a.y);
  const glows: FieldNode[] = [];
  for (const n of still) {
    if (glows.length >= 2) break;
    if (glows.every((g) => Math.hypot(g.x - n.x, g.y - n.y) > 200))
      glows.push(n);
  }

  return {
    nodes,
    edges,
    byNode,
    glows,
    minGap: gap * 0.7,
    maxSignals: w < 620 ? 3 : w < 1000 ? 5 : 8,
    marginX,
    marginY,
  };
}

/** Mostly short lines to nearby dots; none of them crosses the copy. */
export function buildFieldEdges(
  nodes: FieldNode[],
  w: number,
  h: number,
  rects: Rect[],
) {
  const near = Math.max(w, h) * 0.34;
  const seen = new Set<string>();
  const edges: FieldEdge[] = [];
  const degree = new Array(nodes.length).fill(0);

  const add = (i: number, j: number) => {
    const a = Math.min(i, j);
    const b = Math.max(i, j);
    const key = `${a}:${b}`;
    if (a === b || seen.has(key)) return;
    if (degree[a] >= nodes[a].quota || degree[b] >= nodes[b].quota) return;
    if (nodes[a].offFrame && nodes[b].offFrame) return; // both invisible: pointless
    if (!lineClear(nodes[a], nodes[b], rects)) return; // no line crosses the copy
    seen.add(key);
    degree[a]++;
    degree[b]++;
    edges.push({ a: nodes[a], b: nodes[b] });
  };

  for (let i = 0; i < nodes.length; i++) {
    const candidates: { j: number; len: number }[] = [];
    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue;
      const len = Math.hypot(nodes[j].x - nodes[i].x, nodes[j].y - nodes[i].y);
      if (len <= near) candidates.push({ j, len });
    }
    candidates.sort((a, b) => a.len - b.len);
    for (const c of candidates) {
      if (degree[i] >= nodes[i].quota) break;
      add(i, c.j);
    }
  }
  return edges;
}
