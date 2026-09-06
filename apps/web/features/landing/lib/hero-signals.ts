/**
 * The living half of the hero: **drift** and **signals**.
 *
 * `neighbourhood-view.ts` says where the **graph window** lands on the glass,
 * once, as a pure projection. This says what happens on it afterwards — nodes
 * breathing inside a small box around where they were projected, and signals
 * travelling along backbone edges between them. `hero-network.tsx` measures,
 * projects, paints and owns the frame loop; it calls in here for geometry
 * exactly as it already does with `hero-keepout.ts`.
 *
 * **Everything here is bounded by the drawn graph window and cannot see past
 * it.** A window carries a limited set of nodes and the backbone edges that run
 * between them; `anonymise` keeps an edge only when both endpoint tokens
 * resolve, and `projectGraphWindow` drops it again if either endpoint is
 * missing. So a node near the rim has attachments this file has never been told
 * about, and a **burst** reaches every edge that node has *inside the window*
 * and no further. That is a property of the payload rather than a rule enforced
 * here: there is no edge to reach for.
 *
 * **A signal is a dramatisation, chosen on purpose.** A backbone edge records
 * placement history and is not a friendship; ADR 0006 settles that drawing
 * light travelling along one asserts only "this is a community and things move
 * through it", which is true, and that the friend feature must reach for the
 * vocabulary of *travel* — a camera moving — rather than a brighter edge.
 * Nothing here reads a relationship, and nothing here writes a row: the field
 * below is derived from the projection every frame and thrown away with it.
 *
 * **Everything is seeded from stable identity, and there is no `Math.random()`
 * in this file.** The artboard is inconsistent about this — drift comes from a
 * per-node hash (`Landing.dc.html:717`) but the spawn edge, the speed, the
 * prominence and the relay coin all come from `Math.random()` — so the same
 * field replayed twice there is a different field. Deriving all of it from node
 * and edge id plus a sequence counter makes the engine a pure function of the
 * view and the elapsed time, which is what lets a test assert the traffic, lets
 * a reprojection resume rather than restart, and lets a bug report quote a
 * frame. It is a deliberate improvement on the export, not an accident of
 * translation.
 *
 * The two passes of the artboard's own drift loop that are **not** ported, both
 * on the product owner's instruction (#203):
 *
 * - the **frame inset clamp** (:1211-1214), which keeps every node 20px inside
 *   the frame. The artboard constructs its nodes inside the frame; ours are
 *   projected from stored world coordinates and legitimately sit off-canvas,
 *   which is how "the network continues past the frame" already works here.
 * - the **min-gap separation pass** (:1233-1247), whose own comment names its
 *   reason — "drift must not undo the even Halton spread" — and there is no
 *   Halton spread here. It moves real nodes relative to each other, which
 *   changes the shape of a neighbourhood and breaks the recognition promise
 *   `neighbourhood-view.ts` exists to hold.
 */

import { clearAt, lineClearance, type Rect } from "./hero-keepout";
import {
  type GraphWindowView,
  NO_SIGNAL,
  NODE_RADIUS,
  type ScreenNode,
  VISIBLE,
} from "./neighbourhood-view";

/* ------------------------------------------------------------------ drift */

/**
 * Half the width of the box a node wanders inside, in px. The artboard's `R`
 * (:1205): "each student wanders inside a 10px box around where it started".
 */
export const DRIFT_BOX = 5;

/**
 * Drift speed, in px/s: `1.8 + hash * 0.4`, straight from `makeNode` (:716).
 *
 * About five seconds to cross its own box, which is the point of the number.
 * It has to read as the field breathing rather than as an individual dot
 * going somewhere.
 */
const DRIFT_SPEED_MIN = 1.8;
const DRIFT_SPEED_SPAN = 0.4;

/**
 * The extra pixel the turn-away tests with, as `clearAt(n.x, n.y, n.r + 1)`
 * does at :1224. A node turns back one pixel before its own edge would touch
 * the feathered margin, so the copy is never approached at all rather than
 * approached and then dimmed.
 *
 * A **pushed** node gets only half a box out of this, and that is accepted.
 * `pushClear` lands it at `FEATHER + NODE_RADIUS + ε`, which is exactly where
 * `clearAt` first returns 1, so a step towards the copy trips the turn-away on
 * the very next frame. It is self-limiting rather than broken: a node parked at
 * the copy's edge looking crowded is the honest picture, and widening
 * `pushClear`'s margin to buy it a full box would move every node in the hero.
 */
const TURN_MARGIN = 1;

/**
 * The longest step the integrator will take, in seconds — the artboard's own
 * clamp (:1177).
 *
 * A backgrounded tab that comes back hands `requestAnimationFrame` a gap of
 * whole seconds. Integrated straight, that is a node teleporting across its box
 * and a signal arriving instantly; clamped, it is one ordinary frame and the
 * scene picks up where it was.
 */
const MAX_STEP = 0.05;

/* ---------------------------------------------------------------- signals */

/** px/s along the edge: `26 + hash * 22` (:1108). Constant pace, any length. */
const SIGNAL_SPEED_MIN = 26;
const SIGNAL_SPEED_SPAN = 22;

/** The floor on a crossing, in seconds (:1112). A short edge is not a blink. */
const MIN_DURATION = 2.6;

/** How bright one signal is allowed to be: `0.72 + hash * 0.28` (:1114). */
const PROM_MIN = 0.72;
const PROM_SPAN = 0.28;

/** Seconds between ambient spawns: `260 + hash * 900` ms (:1300). */
const SPAWN_GAP_MIN = 0.26;
const SPAWN_GAP_SPAN = 0.9;

/** How many edges an ambient spawn will try before giving up (:1120). */
const SPAWN_ATTEMPTS = 14;

/** The relay coin and its second flip (:1117): 42%, then 35% for a third hop. */
const RELAY_CHANCE = 0.42;
const RELAY_SECOND_CHANCE = 0.35;

/** How far over the cap a relay may take the field (:1305). */
const RELAY_HEADROOM = 3;

/** Seconds between the arms of a burst (:1149). */
const BURST_STAGGER = 0.06;

/**
 * How many concurrent signals the frame will carry, **capped by edge count as
 * well as by width**.
 *
 * The width ladder is the artboard's (:886). The `edges / 4` term is not, and
 * it is the more important half here: the export's numbers assume a dense
 * proximity mesh over a synthetic field, while a real neighbourhood is three to
 * five backbone anchors per node over a community #68 recorded as small. Eight
 * concurrent signals over twelve edges is strobing, not life.
 */
const EDGES_PER_SIGNAL = 4;
const NARROW_WIDTH = 620;
const WIDE_WIDTH = 1000;
const NARROW_CAP = 3;
const MEDIUM_CAP = 5;
const WIDE_CAP = 8;

/**
 * How much a signal fades back while **Find your dot** holds a label up:
 * `1 - 0.74 * dim` (:1368).
 *
 * They fade to about a quarter rather than halting, because a field that
 * stopped dead the moment somebody found their dot would read as the page
 * breaking rather than as the page pointing.
 */
const DIM_FACTOR = 0.74;

/** The pointer is this close to a node's centre before it counts (:1433). */
const HIT_RADIUS = 20;

/** How many frames a full sweep of edge clearances is spread over (:1253). */
const CLEAR_SLICES = 30;

/* -------------------------------------------------------------- the trail */

/**
 * The length of the wake behind the head, in px: `16 + 74 * k` (:1371). It
 * grows with the envelope, so a signal both brightens and lengthens as it
 * leaves and shortens as it lands.
 */
const TRAIL_BASE = 16;
const TRAIL_GAIN = 74;

/** The head's halo radius, in px: `5 + 9 * k` (:1375). */
const HALO_BASE = 5;
const HALO_GAIN = 9;

/** How many discs the halo is drawn as, and how bright its core is at `k = 1`.
 * `PAL.haloA` in the export's palette. See `haloDiscs`. */
const HALO_STEPS = 3;
const HALO_ALPHA = 0.85;

/** The stroke width along the whole trail: `1.1 + 1.9 * k` (:1387). */
const WIDTH_BASE = 1.1;
const WIDTH_GAIN = 1.9;

/**
 * The artboard's gradient (:1382-1386), as stops rather than as a gradient.
 *
 * `createLinearGradient` needs a colour it can vary the alpha of, and every
 * colour on this canvas is a `--cc-*` token read as an opaque string — so
 * matching the export's four stops would mean parsing CSS colour syntax at draw
 * time, or interpolating from `transparent`, which canvas does in
 * non-premultiplied sRGB and which greys the tail. Sampling the same stop curve
 * into a handful of sub-strokes under `globalAlpha` produces the same taper
 * with neither, and it is the technique `COMET_SEGMENTS` already uses in this
 * hero. `at` is the fraction from tail to head; `alpha` multiplies `k`.
 */
const TRAIL_STOPS: { at: number; alpha: number }[] = [
  { at: 0, alpha: 0 },
  { at: 0.55, alpha: 0.5 },
  { at: 0.9, alpha: 0.9 },
  { at: 1, alpha: 1.1 },
];

/** How many sub-strokes the stop curve above is sampled into. */
const TRAIL_STEPS = 8;

/**
 * `fade`: the ring radii and alphas of the standing-still mark, reused moving.
 *
 * The same numbers as `FADE_RINGS` in `hero-network.tsx`, and deliberately so —
 * the moving and the still form of a style have to read as the same family, or
 * a member who picked one in the picker will not recognise what they picked on
 * the landing page. Radii are multiples of `NODE_RADIUS`.
 */
const FADE_TRAIL_RINGS = [
  { reach: 1.9, alpha: 0.34 },
  { reach: 2.9, alpha: 0.19 },
  { reach: 3.9, alpha: 0.1 },
] as const;

/**
 * `comet`: the width and alpha steps of the standing-still mark, reused moving.
 *
 * Mirrors `COMET_SEGMENTS` in `hero-network.tsx`. `from`/`to` are positions
 * along the wake, and only their *proportions* are used: the band they span is
 * stretched over whatever trail the envelope has produced, so the head segment
 * always lands on the head.
 */
const COMET_TRAIL_SEGMENTS = [
  { from: 1.1, to: 2.5, width: 1.7, alpha: 0.62 },
  { from: 2.5, to: 3.9, width: 1.2, alpha: 0.36 },
  { from: 3.9, to: 5.4, width: 0.8, alpha: 0.16 },
] as const;

/** `dashed`: the dash pattern of the standing-still ring, reused moving. */
const DASHED_TRAIL_DASH = [2.2, 2.6];

/**
 * How much longer the `comet` wake runs than the other three.
 *
 * Standing still, `comet` reaches `5.4 * NODE_RADIUS` behind its node and
 * `fade` reaches `3.9` — the comet is the longest of the three marks, by that
 * margin. Moving, it keeps exactly the same margin over the same rival rather
 * than taking a factor chosen by eye. **This is the only thing the style
 * changes.** Head, speed and envelope are identical across all four, because
 * the style is the wake and never the pace: nobody's node may read as faster or
 * more important than anybody else's.
 */
const COMET_LENGTHEN =
  COMET_TRAIL_SEGMENTS[COMET_TRAIL_SEGMENTS.length - 1].to /
  FADE_TRAIL_RINGS[FADE_TRAIL_RINGS.length - 1].reach;

/** The far end of the comet band, in the units `COMET_TRAIL_SEGMENTS` uses. */
const COMET_REACH = COMET_TRAIL_SEGMENTS[COMET_TRAIL_SEGMENTS.length - 1].to;

/* ------------------------------------------------------------ determinism */

/** FNV-1a over a key, as an unsigned 32-bit integer. */
function hashKey(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * A number in `[0, 1)` from a string key and a salt. **The only source of
 * variety in this file.**
 *
 * The artboard's own `hash` (:709) is `frac(sin(i * 12.9898 + salt * 78.233) *
 * 43758.5453)`, which is the standard shader trick and which relies on
 * `Math.sin` — whose precision ECMAScript leaves to the implementation, so two
 * engines may disagree on the last bits and a test written against it would
 * assert one engine's rounding. This is the same idea done in integers
 * (`murmur3`'s finaliser), so the field is byte-identical everywhere.
 */
export function unitHash(key: string, salt: number): number {
  let h = hashKey(key) ^ Math.imul(salt + 1, 0x9e3779b1);
  h ^= h >>> 16;
  h = Math.imul(h, 0x21f0aaad);
  h ^= h >>> 15;
  h = Math.imul(h, 0x735a2d97);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** Salts, named so two uses of `unitHash` can never silently collide. */
const SALT = {
  driftDirection: 1,
  driftSpeed: 2,
  spawnEdge: 5,
  spawnDirection: 6,
  relayCoin: 7,
  relaySecondCoin: 12,
  prominence: 8,
  speed: 9,
  spawnGap: 10,
  relayEdge: 11,
} as const;

/* --------------------------------------------------------------- the model */

/** The four wakes a signal can leave. `default` is what an unconfigured node
 * sends, which today is nearly everybody. */
export type TrailStyle = "default" | "fade" | "comet" | "dashed";

/**
 * One node, drifting around where the projection put it.
 *
 * `node` is the projected `ScreenNode`, untouched — it is the **home**, and
 * `x`/`y` are where this node has wandered to. Keeping them apart is what makes
 * the drift an overlay on a pure projection rather than a mutation of it, and
 * it is what lets a reprojection re-home a node without losing where it was.
 */
export type FieldNode = {
  node: ScreenNode;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** `clearAt` at the live position, not at the projected one. */
  clearance: number;
};

/** One backbone edge, with the clearance of the line as it is drifting now. */
export type FieldEdge = {
  /** Identity across a reprojection: the two node ids, in stored order. */
  key: string;
  from: FieldNode;
  to: FieldNode;
  clearance: number;
};

/**
 * One signal in flight.
 *
 * It stores no endpoints. They are read from the live node positions every
 * frame (:1310), because a burst whose arms stayed where the node was when it
 * was clicked detaches from the dot that sent it within a second.
 *
 * It carries **no payload**, and that is settled. The artboard gives each
 * signal a line from `INSIGHTS` (:620) — invented review text, which is the
 * production mock data #134 forbids — and the note card that would have shown
 * it is never drawn: `closeCard()` and `scheduleClose()` are empty stubs. A
 * signal that carries nothing is faithful to the artboard as shipped.
 */
export type Signal = {
  id: number;
  edgeKey: string;
  /** The node that sent it, and whose `signalStyle` picked the wake. */
  fromId: string;
  /** The node it is arriving at, and which may relay it onward. */
  toId: string;
  /** Progress along the edge. Negative while a burst arm waits its turn. */
  p: number;
  speed: number;
  prom: number;
  /** Hops left after this one. */
  relay: number;
  style: TrailStyle;
};

/**
 * Everything the loop mutates, and the only mutable state this hero has.
 *
 * Rebuilt from the view by `syncField` on every reprojection; nothing in it is
 * ever written back to the server, and nothing in it outlives the component.
 */
export type HeroField = {
  nodes: FieldNode[];
  nodeById: Map<string, FieldNode>;
  edges: FieldEdge[];
  edgeByKey: Map<string, FieldEdge>;
  edgesByNode: Map<string, FieldEdge[]>;
  signals: Signal[];
  rects: Rect[];
  /** Seconds of animation, which is the clock everything else is keyed on. */
  elapsed: number;
  /** Signals created so far. The sequence half of every seed. */
  seq: number;
  /** Ambient spawn attempts so far, so a failed attempt does not repeat. */
  attempt: number;
  /** `elapsed` at which the next ambient spawn is due. */
  nextSpawn: number;
  /** Where the rolling edge-clearance refresh has got to. */
  clearCursor: number;
  /** Concurrent ambient signals allowed on this frame. */
  cap: number;
};

export function createField(): HeroField {
  return {
    nodes: [],
    nodeById: new Map(),
    edges: [],
    edgeByKey: new Map(),
    edgesByNode: new Map(),
    signals: [],
    rects: [],
    elapsed: 0,
    seq: 0,
    attempt: 0,
    nextSpawn: 0,
    clearCursor: 0,
    cap: 0,
  };
}

/** The identity of an edge across a reprojection: its two endpoints' ids. */
export function edgeKey(fromId: string, toId: string): string {
  return `${fromId}|${toId}`;
}

function viewportCap(width: number): number {
  if (width < NARROW_WIDTH) return NARROW_CAP;
  if (width < WIDE_WIDTH) return MEDIUM_CAP;
  return WIDE_CAP;
}

/**
 * Point the field at a freshly projected view. **Reproject, do not reset.**
 *
 * A resize re-derives every screen coordinate, but the people did not change:
 * `WindowNode.id` is stable for the life of a response, so a node keeps its
 * offset from home and its heading, and a signal keeps its progress `p` and
 * simply finds its edge in a new place. Blanking the field because somebody
 * dragged a window edge reads as a glitch.
 *
 * A **refetch** is the other case and needs no separate branch. `service.ts`
 * mints `crypto.randomUUID()` per response, so a new read means new ids, no
 * node or edge is recognised, and the field is rebuilt from nothing — which is
 * exactly "clear and restart". Different ids are genuinely different
 * people-slots, so resuming across them would be resuming onto strangers.
 */
export function syncField(
  field: HeroField,
  view: GraphWindowView | null,
  rects: Rect[],
  width: number,
): void {
  field.rects = rects;

  const previous = field.nodeById;
  const nodes: FieldNode[] = [];
  const nodeById = new Map<string, FieldNode>();
  for (const node of view?.nodes ?? []) {
    const was = previous.get(node.id);
    const placed = was ? rehome(was, node) : seedNode(node);
    placed.clearance = clearAt(placed.x, placed.y, rects, NODE_RADIUS);
    nodes.push(placed);
    nodeById.set(node.id, placed);
  }

  const wasEdge = field.edgeByKey;
  const edges: FieldEdge[] = [];
  const edgeByKey = new Map<string, FieldEdge>();
  const edgesByNode = new Map<string, FieldEdge[]>();
  for (const edge of view?.edges ?? []) {
    const from = nodeById.get(edge.from.id);
    const to = nodeById.get(edge.to.id);
    if (!from || !to) continue;
    const key = edgeKey(edge.from.id, edge.to.id);
    const placed: FieldEdge = {
      key,
      from,
      to,
      // The projection already sampled this line; take its answer rather than
      // paying for eleven more samples per edge on a frame that is already
      // rebuilding everything.
      clearance: wasEdge.get(key)?.clearance ?? edge.clearance,
    };
    edges.push(placed);
    edgeByKey.set(key, placed);
    for (const id of [edge.from.id, edge.to.id]) {
      const list = edgesByNode.get(id);
      if (list) list.push(placed);
      else edgesByNode.set(id, [placed]);
    }
  }

  field.nodes = nodes;
  field.nodeById = nodeById;
  field.edges = edges;
  field.edgeByKey = edgeByKey;
  field.edgesByNode = edgesByNode;
  field.cap = Math.min(
    viewportCap(width),
    Math.ceil(edges.length / EDGES_PER_SIGNAL),
  );
  field.clearCursor = 0;
  // A signal whose edge or sender did not survive has nowhere to be.
  field.signals = field.signals.filter(
    (signal) =>
      edgeByKey.has(signal.edgeKey) &&
      nodeById.has(signal.fromId) &&
      nodeById.has(signal.toId),
  );
}

/** A node the field has not seen before: at home, heading somewhere stable. */
function seedNode(node: ScreenNode): FieldNode {
  const direction = unitHash(node.id, SALT.driftDirection) * Math.PI * 2;
  const speed =
    DRIFT_SPEED_MIN + unitHash(node.id, SALT.driftSpeed) * DRIFT_SPEED_SPAN;
  return {
    node,
    x: node.screenX,
    y: node.screenY,
    vx: Math.cos(direction) * speed,
    vy: Math.sin(direction) * speed,
    clearance: node.clearance,
  };
}

/** The same node, projected somewhere else: keep the wander, move the home. */
function rehome(was: FieldNode, node: ScreenNode): FieldNode {
  const offsetX = clampBox(was.x - was.node.screenX);
  const offsetY = clampBox(was.y - was.node.screenY);
  return {
    node,
    x: node.screenX + offsetX,
    y: node.screenY + offsetY,
    vx: was.vx,
    vy: was.vy,
    clearance: node.clearance,
  };
}

function clampBox(offset: number): number {
  return Math.max(-DRIFT_BOX, Math.min(DRIFT_BOX, offset));
}

/**
 * One frame of the model: drift, refresh, spawn, advance.
 *
 * `holdId` is the node that must not move — the viewer's own, while **Find your
 * dot** holds a label on it. The artboard checks an `n.fixed` flag at :1202
 * that nothing anywhere sets, a dead branch somebody meant to use; its own
 * prose says what it was for at :814, *"the graph never moves: the dot grows
 * and pulses in place"*. This is the one place we follow the artboard's words
 * over its code. The held node resumes from where it stopped, not from home.
 */
export function advanceField(
  field: HeroField,
  dt: number,
  options: { holdId?: string | null } = {},
): void {
  const step = Math.max(0, Math.min(MAX_STEP, dt));
  field.elapsed += step;
  drift(field, step, options.holdId ?? null);
  refreshEdgeClearance(field);
  spawnAmbient(field);
  advanceSignals(field, step);
}

/** Port of :1200-1227, less the frame inset clamp and the separation pass. */
function drift(field: HeroField, step: number, holdId: string | null): void {
  for (const node of field.nodes) {
    if (node.node.id !== holdId) {
      const homeX = node.node.screenX;
      const homeY = node.node.screenY;
      node.x += node.vx * step;
      node.y += node.vy * step;

      if (node.x < homeX - DRIFT_BOX) {
        node.x = homeX - DRIFT_BOX;
        node.vx = Math.abs(node.vx);
      }
      if (node.x > homeX + DRIFT_BOX) {
        node.x = homeX + DRIFT_BOX;
        node.vx = -Math.abs(node.vx);
      }
      if (node.y < homeY - DRIFT_BOX) {
        node.y = homeY - DRIFT_BOX;
        node.vy = Math.abs(node.vy);
      }
      if (node.y > homeY + DRIFT_BOX) {
        node.y = homeY + DRIFT_BOX;
        node.vy = -Math.abs(node.vy);
      }

      // Drift never carries anybody into the copy: it turns away at the margin.
      if (clearAt(node.x, node.y, field.rects, NODE_RADIUS + TURN_MARGIN) < 1) {
        node.x -= node.vx * step * 2;
        node.y -= node.vy * step * 2;
        node.vx = -node.vx;
        node.vy = -node.vy;
        // The step back is twice the step forward, so it can leave the box by
        // up to one frame's travel. The artboard lets that stand; here the box
        // is the invariant the tests hold, so it is closed rather than nearly
        // held.
        node.x = homeX + clampBox(node.x - homeX);
        node.y = homeY + clampBox(node.y - homeY);
      }
    }

    node.clearance = clearAt(node.x, node.y, field.rects, NODE_RADIUS);
  }
}

/**
 * A rolling slice of the edge clearances, never the whole set (:1251-1260).
 *
 * `lineClearance` samples eleven points per edge against every measured rect,
 * so re-deriving all of them every frame is the one thing in this loop that
 * would actually cost something. Drift is clamped to `DRIFT_BOX`, so an edge's
 * clearance moves by a few pixels' worth at most between refreshes — spreading
 * a full sweep over `CLEAR_SLICES` frames is well inside what the eye can tell.
 */
function refreshEdgeClearance(field: HeroField): void {
  const edges = field.edges;
  if (!edges.length) {
    field.clearCursor = 0;
    return;
  }
  const slice = Math.max(1, Math.ceil(edges.length / CLEAR_SLICES));
  const from = field.clearCursor;
  for (let i = 0; i < slice; i++) {
    const edge = edges[(from + i) % edges.length];
    edge.clearance = lineClearance(
      { x: edge.from.x, y: edge.from.y },
      { x: edge.to.x, y: edge.to.y },
      field.rects,
    );
  }
  field.clearCursor = (from + slice) % edges.length;
}

/**
 * The ambient producer: `spawnSignal` (:1116), with two rules of our own.
 *
 * Never two signals on one edge, which is the export's. And **never an edge
 * below `VISIBLE`**, which is not: `routeClear` (:1092) is defined in the
 * export and never called from anywhere, and `drawSignal` never multiplies by
 * clearance either, so a signal there can run straight over the headline. The
 * invariant `hero-network.tsx` states — everything painted on this canvas
 * passes the clearance check — holds here too.
 */
function spawnAmbient(field: HeroField): void {
  if (field.elapsed < field.nextSpawn) return;
  if (field.signals.length >= field.cap) return;
  const edges = field.edges;
  if (!edges.length) return;

  const attempt = field.attempt++;
  for (let i = 0; i < SPAWN_ATTEMPTS; i++) {
    const roll = unitHash(`spawn:${attempt}:${i}`, SALT.spawnEdge);
    const edge =
      edges[Math.min(edges.length - 1, Math.floor(roll * edges.length))];
    if (edge.clearance <= VISIBLE) continue;
    if (field.signals.some((signal) => signal.edgeKey === edge.key)) continue;
    const forward =
      unitHash(`dir:${edge.key}:${attempt}`, SALT.spawnDirection) < 0.5;
    field.signals.push(makeSignal(field, edge, forward ? edge.from : edge.to));
    break;
  }

  // Rescheduled whether or not an edge was free, exactly as the export does:
  // a frame with nowhere to put a signal waits for the next slot rather than
  // retrying fourteen times per frame forever.
  field.nextSpawn =
    field.elapsed +
    SPAWN_GAP_MIN +
    unitHash(`gap:${attempt}`, SALT.spawnGap) * SPAWN_GAP_SPAN;
}

/**
 * The wake a node sends. **Every node signals**; the tier picks only the style.
 *
 * An unconfigured node — which today is very nearly all of them — sends the
 * `default` wake, exactly as it draws the default shape and the default
 * colour. Gating the signal itself on tier 3 would have made the feature
 * invisible on the community #68 recorded and accepted.
 */
export function trailStyleOf(node: ScreenNode): TrailStyle {
  return node.signalStyle === NO_SIGNAL ? "default" : node.signalStyle;
}

function makeSignal(
  field: HeroField,
  edge: FieldEdge,
  from: FieldNode,
  overrides: { relay?: number; p?: number } = {},
): Signal {
  const id = ++field.seq;
  const seed = `signal:${edge.key}:${id}`;
  const to = from === edge.from ? edge.to : edge.from;
  const relayed =
    unitHash(seed, SALT.relayCoin) < RELAY_CHANCE
      ? 1 + (unitHash(seed, SALT.relaySecondCoin) < RELAY_SECOND_CHANCE ? 1 : 0)
      : 0;
  return {
    id,
    edgeKey: edge.key,
    fromId: from.node.id,
    toId: to.node.id,
    p: overrides.p ?? 0,
    speed: SIGNAL_SPEED_MIN + unitHash(seed, SALT.speed) * SIGNAL_SPEED_SPAN,
    prom: PROM_MIN + unitHash(seed, SALT.prominence) * PROM_SPAN,
    relay: overrides.relay ?? relayed,
    style: trailStyleOf(from.node),
  };
}

/**
 * `relaySignal` (:1128): the signal carries on from the node that received it.
 *
 * A relay is ambient traffic continuing rather than a gesture anybody made, so
 * it takes the ambient producer's rules: not back down the edge it arrived on,
 * not onto an edge already carrying something, and **not onto an edge the copy
 * has buried**. A burst is the one producer exempt from that last rule, because
 * a burst arm is somebody's click and a missing arm would read as broken.
 */
function relaySignal(field: HeroField, arrived: Signal): void {
  const from = field.nodeById.get(arrived.toId);
  if (!from) return;
  const open = (field.edgesByNode.get(arrived.toId) ?? []).filter(
    (edge) =>
      edge.key !== arrived.edgeKey &&
      edge.clearance > VISIBLE &&
      !field.signals.some((signal) => signal.edgeKey === edge.key),
  );
  if (!open.length) return;
  const roll = unitHash(`relay:${arrived.id}`, SALT.relayEdge);
  const edge = open[Math.min(open.length - 1, Math.floor(roll * open.length))];
  field.signals.push(
    makeSignal(field, edge, from, { relay: arrived.relay - 1 }),
  );
}

/**
 * `burst` (:1140): one click fans a signal out along every free backbone edge
 * the node has **within the drawn graph window**, staggered so they leave in
 * order rather than as a ring. It does not reach a node the window does not
 * hold, because no such edge is on the wire to begin with.
 *
 * Unlike the ambient producer this does not skip a dim edge, and does not stop
 * at the cap. A burst is a gesture somebody made: an arm that simply was not
 * there would read as broken, whereas an arm that draws faint-to-invisible
 * under the copy reads as depth. The cap exists to keep ambient traffic from
 * strobing, and a click is not ambient traffic.
 *
 * Skipping the cap costs nothing unbounded, which is the reason it is safe to
 * do: one edge carries one signal, so however fast somebody clicks, the field
 * cannot hold more signals than the graph window has edges — and a window is a
 * *bounded* slice of the community by construction.
 */
export function burstAt(field: HeroField, node: FieldNode): void {
  let delay = 0;
  for (const edge of field.edgesByNode.get(node.node.id) ?? []) {
    if (field.signals.some((signal) => signal.edgeKey === edge.key)) continue;
    field.signals.push(makeSignal(field, edge, node, { relay: 0, p: -delay }));
    delay += BURST_STAGGER;
  }
}

function edgeLength(edge: FieldEdge): number {
  return Math.max(
    1,
    Math.hypot(edge.to.x - edge.from.x, edge.to.y - edge.from.y),
  );
}

function advanceSignals(field: HeroField, step: number): void {
  for (let i = field.signals.length - 1; i >= 0; i--) {
    const signal = field.signals[i];
    const edge = field.edgeByKey.get(signal.edgeKey);
    if (!edge) {
      field.signals.splice(i, 1);
      continue;
    }
    // The pace is constant in px/s regardless of how long the edge is, with a
    // floor so a short edge is a crossing rather than a blink.
    const duration = Math.max(MIN_DURATION, edgeLength(edge) / signal.speed);
    signal.p += step / duration;
    if (signal.p < 1) continue;
    field.signals.splice(i, 1);
    if (signal.relay > 0 && field.signals.length < field.cap + RELAY_HEADROOM) {
      relaySignal(field, signal);
    }
  }
}

/**
 * The node under the pointer, if any: `hitAt` (:1424).
 *
 * Nearest within `HIT_RADIUS`, and **an invisible node is not clickable** —
 * anything the clearance check would not paint is skipped here for the same
 * reason it is skipped there. The export tests its own mask at 0.35; ours tests
 * `VISIBLE`, because `pushClear` means our nodes are either placed clear or not
 * placed at all.
 */
export function hitTest(
  field: HeroField,
  x: number,
  y: number,
): FieldNode | null {
  let best: FieldNode | null = null;
  let bestDistance = HIT_RADIUS * HIT_RADIUS;
  for (const node of field.nodes) {
    if (node.clearance <= VISIBLE) continue;
    const dx = node.x - x;
    const dy = node.y - y;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = node;
    }
  }
  return best;
}

/* --------------------------------------------------------------- painting */

/** One stroked piece of a wake. */
export type TrailStroke = {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  width: number;
  alpha: number;
};

/** One ring dropped behind the head, for the `fade` wake. */
export type TrailRing = {
  x: number;
  y: number;
  radius: number;
  alpha: number;
};

/** One filled disc of the head's halo. */
export type TrailDisc = { x: number; y: number; radius: number; alpha: number };

/**
 * Everything one signal asks the canvas for, as data.
 *
 * The painter sets a colour and traces this; it makes no decisions. That is
 * what lets the geometry be asserted with a plain object and a fake clock
 * rather than through `getContext("2d")`.
 */
export type SignalPaint = {
  /** The custom property the sending node draws in. A signal is *theirs*. */
  colorVar: string;
  headX: number;
  headY: number;
  /** The head, identical across all four styles. */
  halo: TrailDisc[];
  /** The wake as strokes. Empty for `fade`. */
  strokes: TrailStroke[];
  /** The wake as rings. Empty for everything but `fade`. */
  rings: TrailRing[];
  /** The dash pattern the strokes are traced through, or `null`. */
  dash: number[] | null;
};

/** `env` (:1157): faint on departure, defined mid-flight, gone on arrival. */
export function envelope(p: number): number {
  const rise = smoothStep(0.03, 0.42, p) ** 1.5;
  const fall = 1 - smoothStep(0.86, 1, p);
  return Math.min(rise, fall);
}

function smoothStep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * Which way along the edge this signal is actually going.
 *
 * A **backbone edge** is stored newer-to-older and drawn undirected, but a
 * signal has a sender and a receiver — `spawnSignal` tosses for the end it
 * leaves from and a **burst** leaves from whichever node was clicked, which is
 * as often the edge's `to` as its `from`. So `p` is progress *from the sender*,
 * and everything geometric below has to be measured from the sender rather than
 * from whichever endpoint the view model happened to list first. Getting this
 * wrong draws the signal running backwards, out of a node that did not send it.
 */
function travel(edge: FieldEdge, signal: Signal) {
  const forward = signal.fromId === edge.from.node.id;
  const a = forward ? edge.from : edge.to;
  const b = forward ? edge.to : edge.from;
  const length = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
  return {
    /** The sender's end. */
    ax: a.x,
    ay: a.y,
    /** The receiver's end. */
    bx: b.x,
    by: b.y,
    length,
    /** A unit vector pointing the way the signal is travelling. */
    ux: (b.x - a.x) / length,
    uy: (b.y - a.y) / length,
  };
}

/**
 * The `at(s, p)` of :1091, which — its control point being the midpoint of its
 * own endpoints — reduces exactly to a straight interpolation. Written as one,
 * and measured from the sender.
 */
function pointAt(along: ReturnType<typeof travel>, p: number) {
  return {
    x: along.ax + (along.bx - along.ax) * p,
    y: along.ay + (along.by - along.ay) * p,
  };
}

/**
 * Below this the signal is not drawn at all — the export's own guard (:1369).
 */
const PAINT_FLOOR = 0.002;

/**
 * What to draw for one signal on this frame, or `null` if it is not visible.
 *
 * `dim` is **Find your dot** holding a label up. The field fades back to about
 * a quarter for as long as it does — but a signal the viewer's own node sent is
 * exempt, as their node is at :1281, because a burst from the dot the page has
 * just pointed at is the best discovery moment this feature has and dimming it
 * would be pointing and then looking away.
 */
export function signalPaint(
  field: HeroField,
  signal: Signal,
  options: { dim?: boolean } = {},
): SignalPaint | null {
  const edge = field.edgeByKey.get(signal.edgeKey);
  const sender = field.nodeById.get(signal.fromId);
  if (!edge || !sender) return null;
  if (signal.p <= 0 || signal.p >= 1) return null;

  const dimmed = options.dim && !sender.node.isViewer ? 1 - DIM_FACTOR : 1;
  const k = Math.min(
    1,
    envelope(signal.p) * signal.prom * edge.clearance * dimmed,
  );
  if (k <= PAINT_FLOOR) return null;

  const along = travel(edge, signal);
  const wanted =
    (TRAIL_BASE + TRAIL_GAIN * k) *
    (signal.style === "comet" ? COMET_LENGTHEN : 1);
  // Never behind the node it left: a wake that ran off the end of its own edge
  // would be a line to somebody the signal is not travelling to.
  const back = Math.min(signal.p, wanted / along.length);
  const head = pointAt(along, signal.p);
  const tail = pointAt(along, signal.p - back);
  const available = back * along.length;
  const width = WIDTH_BASE + WIDTH_GAIN * k;

  const paint: SignalPaint = {
    colorVar: sender.node.colorVar,
    headX: head.x,
    headY: head.y,
    halo: haloDiscs(head.x, head.y, k),
    strokes: [],
    rings: [],
    dash: signal.style === "dashed" ? DASHED_TRAIL_DASH : null,
  };

  if (signal.style === "fade") {
    const steps = FADE_TRAIL_RINGS.length;
    const lead = FADE_TRAIL_RINGS[0].alpha;
    FADE_TRAIL_RINGS.forEach((ring, index) => {
      // Each ring is dropped further back than the last, and is wider and
      // fainter for having been left there longer.
      const at = signal.p - back * ((index + 1) / steps);
      const spot = pointAt(along, at);
      paint.rings.push({
        x: spot.x,
        y: spot.y,
        radius: NODE_RADIUS * ring.reach,
        alpha: k * (ring.alpha / lead),
      });
    });
    return paint;
  }

  if (signal.style === "comet") {
    const lead = COMET_TRAIL_SEGMENTS[0];
    for (const segment of COMET_TRAIL_SEGMENTS) {
      const near = available * (segment.from / COMET_REACH);
      const far = available * (segment.to / COMET_REACH);
      paint.strokes.push({
        fromX: head.x - along.ux * far,
        fromY: head.y - along.uy * far,
        toX: head.x - along.ux * near,
        toY: head.y - along.uy * near,
        width: width * (segment.width / lead.width),
        alpha: k * (segment.alpha / lead.alpha),
      });
    }
    return paint;
  }

  // `default` and `dashed`: the artboard's single tapering stroke, sampled off
  // `TRAIL_STOPS` into sub-strokes so the taper needs no colour arithmetic.
  for (let i = 0; i < TRAIL_STEPS; i++) {
    const a = i / TRAIL_STEPS;
    const b = (i + 1) / TRAIL_STEPS;
    paint.strokes.push({
      fromX: tail.x + (head.x - tail.x) * a,
      fromY: tail.y + (head.y - tail.y) * a,
      toX: tail.x + (head.x - tail.x) * b,
      toY: tail.y + (head.y - tail.y) * b,
      width,
      alpha: Math.min(1, k * stopAlpha((a + b) / 2)),
    });
  }
  return paint;
}

/** `TRAIL_STOPS`, interpolated. `at` runs 0 at the tail to 1 at the head. */
function stopAlpha(at: number): number {
  let previous = TRAIL_STOPS[0];
  for (const stop of TRAIL_STOPS) {
    if (at <= stop.at) {
      const span = stop.at - previous.at;
      const t = span > 0 ? (at - previous.at) / span : 1;
      return previous.alpha + (stop.alpha - previous.alpha) * t;
    }
    previous = stop;
  }
  return previous.alpha;
}

/**
 * The head's halo, as discs rather than as a radial gradient.
 *
 * Same reason as `TRAIL_STOPS`: the colour is a token, not something whose
 * alpha this file can vary inside a gradient stop. Three concentric discs of
 * falling alpha read as the export's `createRadialGradient` halo does at the
 * five-to-fourteen pixel radii it actually uses, and cost three arcs.
 */
function haloDiscs(x: number, y: number, k: number): TrailDisc[] {
  const reach = HALO_BASE + HALO_GAIN * k;
  const discs: TrailDisc[] = [];
  // Widest first, so the core is painted over its own glow rather than under
  // it. Alpha falls as the square of the radius, which is the shape of the
  // export's gradient between `haloA` at the centre and zero at the rim.
  for (let i = HALO_STEPS; i >= 1; i--) {
    const t = i / HALO_STEPS;
    discs.push({
      x,
      y,
      radius: reach * t,
      alpha: k * HALO_ALPHA * (1 - t + 1 / HALO_STEPS) ** 2,
    });
  }
  return discs;
}
