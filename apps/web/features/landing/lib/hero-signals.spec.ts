import { describe, expect, it } from "vitest";
import type { Rect } from "./hero-keepout";
import {
  advanceField,
  burstAt,
  createField,
  DRIFT_BOX,
  edgeKey,
  envelope,
  type HeroField,
  hitTest,
  signalPaint,
  syncField,
  trailStyleOf,
  unitHash,
} from "./hero-signals";
import {
  type GraphWindowView,
  NODE_RADIUS,
  projectGraphWindow,
  type ScreenNode,
  VIEW_SCALE,
  VISIBLE,
} from "./neighbourhood-view";

/**
 * The engine behind the hero, with no canvas anywhere near it.
 *
 * `hero-signals.ts` is a pure function of the **graph window** and the elapsed
 * time — everything it varies is derived from node and edge identity, and there
 * is no `Math.random()` in it — so all of this runs against a plain object and
 * a hand-cranked clock. That property is the point rather than a convenience:
 * the artboard samples its spawn edge, speed, prominence and relay coin from
 * `Math.random()`, so the same field replayed twice there is a different field
 * and none of what follows could be asserted at all.
 *
 * `hero-network.spec.tsx` holds the canvas around this: what repaints, what
 * gates the loop, and what the pointer does.
 */

/** A projected node, as `projectGraphWindow` would hand one over. */
function screenNode(over: Partial<ScreenNode> = {}): ScreenNode {
  return {
    id: "n",
    screenX: 100,
    screenY: 100,
    colorVar: "--cc-brand",
    style: "solid",
    signalStyle: "none",
    isViewer: false,
    clearance: 1,
    ...over,
  };
}

/**
 * A view built by hand: `n` nodes on a horizontal line, chained end to end.
 *
 * A chain rather than a mesh because a chain is the shape a **backbone edge**
 * actually makes — a joining node takes three to five anchors and nobody is
 * re-placed — and because every node in it has a known, small degree, which is
 * what makes a burst's arm count assertable.
 */
function chain(
  count: number,
  over: Partial<ScreenNode> = {},
  spacing = 90,
): GraphWindowView {
  const nodes = Array.from({ length: count }, (_, i) =>
    screenNode({
      id: `n${i}`,
      screenX: 100 + i * spacing,
      screenY: 300,
      ...over,
    }),
  );
  const edges = nodes.slice(1).map((to, i) => ({
    from: nodes[i],
    to,
    clearance: 1,
  }));
  return { scale: VIEW_SCALE, centre: { x: 0, y: 0 }, nodes, edges };
}

/** A field pointed at `view`, with no copy in the way unless one is given. */
function fieldOf(view: GraphWindowView, rects: Rect[] = [], width = 1200) {
  const field = createField();
  syncField(field, view, rects, width);
  return field;
}

/** Run `seconds` of animation at 60fps, which is how the loop drives it. */
function run(
  field: HeroField,
  seconds: number,
  options: { holdId?: string | null } = {},
) {
  const step = 1 / 60;
  for (let i = 0; i < Math.round(seconds / step); i++) {
    advanceField(field, step, options);
  }
}

describe("unitHash", () => {
  /**
   * The whole engine rests on this: the same key is the same number, forever
   * and on every machine. The artboard's own hash goes through `Math.sin`,
   * whose precision ECMAScript leaves to the implementation; this is integer
   * arithmetic end to end.
   */
  it("is stable for a key and spread across its salts", () => {
    expect(unitHash("node-a", 1)).toBe(unitHash("node-a", 1));
    expect(unitHash("node-a", 1)).not.toBe(unitHash("node-a", 2));
    expect(unitHash("node-a", 1)).not.toBe(unitHash("node-b", 1));
  });

  it("stays inside the unit interval for a large sample", () => {
    for (let i = 0; i < 500; i++) {
      const value = unitHash(`node-${i}`, i % 13);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("drift", () => {
  /**
   * The invariant the whole of drift exists to hold.
   *
   * A node wanders inside a ±5px box around the position the projection gave
   * it and reflects off the walls. It is not a simulation with a settling time
   * — there is no separation pass and no inset clamp to fight with — so the box
   * holds on the first frame and on the ten-thousandth alike.
   */
  it("keeps every node inside its own box, however long it runs", () => {
    const view = chain(6);
    const field = fieldOf(view);
    run(field, 120);

    for (const node of field.nodes) {
      expect(Math.abs(node.x - node.node.screenX)).toBeLessThanOrEqual(
        DRIFT_BOX + 1e-9,
      );
      expect(Math.abs(node.y - node.node.screenY)).toBeLessThanOrEqual(
        DRIFT_BOX + 1e-9,
      );
    }
  });

  /** The field breathes; it does not sit still. */
  it("actually moves a node off its home", () => {
    const field = fieldOf(chain(4));
    run(field, 2);

    const moved = field.nodes.filter(
      (node) =>
        Math.hypot(node.x - node.node.screenX, node.y - node.node.screenY) > 1,
    );
    expect(moved.length).toBe(field.nodes.length);
  });

  /** About five seconds to cross its own box: 1.8–2.2 px/s, and no faster. */
  it("drifts at the artboard's pace, so it reads as the field breathing", () => {
    const field = fieldOf(chain(12));

    for (const node of field.nodes) {
      const speed = Math.hypot(node.vx, node.vy);
      expect(speed).toBeGreaterThanOrEqual(1.8);
      expect(speed).toBeLessThanOrEqual(2.2);
    }
  });

  /**
   * Drift never carries anybody into the copy: it turns away at the margin.
   *
   * The rect below sits immediately to the right of a node whose home is well
   * clear of it, so the only way in is by drifting — and the assertion is that
   * `clearAt` never drops below 1 for it, which is the same statement as "the
   * copy is never approached", not merely "never covered".
   */
  it("turns away from the copy rather than fading into it", () => {
    const node = screenNode({ id: "solo", screenX: 100, screenY: 100 });
    const view: GraphWindowView = {
      scale: VIEW_SCALE,
      centre: { x: 0, y: 0 },
      nodes: [node],
      edges: [],
    };
    // `FEATHER` is 10 and the node's radius is 4, so a rect whose left edge is
    // 15px away is exactly one drifting pixel outside the turn-away margin.
    const rects: Rect[] = [{ x: 115, y: 0, w: 400, h: 400 }];
    const field = fieldOf(view, rects);

    run(field, 60);

    for (const drifted of field.nodes) {
      expect(drifted.clearance).toBe(1);
    }
  });

  /**
   * **Find your dot** labels a node and that node stops.
   *
   * The artboard checks an `n.fixed` flag that nothing in it ever sets; its own
   * prose says what it was for — "the graph never moves: the dot grows and
   * pulses in place" — and this is the one place the words win over the code.
   * The held node then resumes from where it stopped rather than snapping home.
   */
  it("holds the labelled node still, and resumes it where it stopped", () => {
    const field = fieldOf(chain(3));
    run(field, 1.5);
    const held = field.nodes[1];
    const parked = { x: held.x, y: held.y };

    run(field, 3, { holdId: held.node.id });
    expect(held.x).toBe(parked.x);
    expect(held.y).toBe(parked.y);

    run(field, 0.5);
    expect(Math.hypot(held.x - parked.x, held.y - parked.y)).toBeGreaterThan(0);
  });
});

describe("signal traffic", () => {
  it("puts ambient signals on the wire on its own", () => {
    const field = fieldOf(chain(10));
    run(field, 6);

    expect(field.signals.length).toBeGreaterThan(0);
  });

  /** Never two signals on one edge — a wire carries one thing at a time. */
  it("never runs two signals along one backbone edge", () => {
    const field = fieldOf(chain(10));
    run(field, 60);

    const keys = field.signals.map((signal) => signal.edgeKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  /**
   * Density is capped by edge count as well as by viewport width.
   *
   * The artboard's 3/5/8 ladder assumes a dense proximity mesh over a synthetic
   * field. A real graph window is three to five anchors per node over a small
   * community, and eight concurrent signals over twelve edges is strobing
   * rather than life — so the cap is `min(width ladder, edges / 4)`.
   */
  it("caps ambient density by edge count, not only by viewport width", () => {
    // Nine nodes, eight edges: two, well under the wide viewport's eight.
    const field = fieldOf(chain(9), [], 1400);
    expect(field.cap).toBe(2);

    run(field, 90);
    expect(field.signals.length).toBeLessThanOrEqual(field.cap + 3);
  });

  it("takes the viewport ladder when the graph window is dense enough", () => {
    const dense = fieldOf(chain(60), [], 500);
    expect(dense.cap).toBe(3);
  });

  /**
   * `routeClear` (:1092) is defined in the export and called from nowhere, and
   * `drawSignal` never multiplies by clearance either — so a signal there can
   * run straight over the headline. The invariant this hero already states is
   * that everything painted on the canvas passes the clearance check, and an
   * ambient signal is not an exception to it.
   */
  it("never spawns ambient traffic onto an edge under the copy", () => {
    const view = chain(10);
    // A band across the middle of the chain, so the inner edges are buried.
    const rects: Rect[] = [{ x: 250, y: 200, w: 400, h: 200 }];
    const field = fieldOf(view, rects);
    run(field, 90);

    const buried = field.edges.filter((edge) => edge.clearance <= VISIBLE);
    expect(buried.length).toBeGreaterThan(0);
    for (const signal of field.signals) {
      const edge = field.edgeByKey.get(signal.edgeKey);
      expect(edge?.clearance).toBeGreaterThan(VISIBLE);
    }
  });

  /** The engine is a pure function of the graph window and the elapsed time. */
  it("replays identically from the same graph window and the same clock", () => {
    const first = fieldOf(chain(8));
    const second = fieldOf(chain(8));
    run(first, 30);
    run(second, 30);

    expect(second.signals.map((s) => [s.edgeKey, s.fromId, s.p])).toEqual(
      first.signals.map((s) => [s.edgeKey, s.fromId, s.p]),
    );
    expect(second.nodes.map((n) => [n.x, n.y])).toEqual(
      first.nodes.map((n) => [n.x, n.y]),
    );
  });
});

describe("burst", () => {
  /**
   * A click fans a signal out along **every free backbone edge the node has
   * inside the drawn graph window** — never along an edge the payload does not
   * carry, because there is no such edge here to reach for.
   */
  it("fires one arm per edge of the node that was clicked", () => {
    const field = fieldOf(chain(5));
    // The middle of a chain: two edges, so an arm count of two is a fact about
    // the node rather than about the fixture's size.
    const middle = field.nodes[2];
    burstAt(field, middle);

    expect(field.signals).toHaveLength(2);
    for (const signal of field.signals) {
      expect(signal.fromId).toBe(middle.node.id);
      // A burst does not relay: it is one gesture, not a chain reaction.
      expect(signal.relay).toBe(0);
    }
  });

  /** Staggered, so the arms leave in order rather than as a ring. */
  it("staggers the arms rather than firing them as one ring", () => {
    const field = fieldOf(chain(5));
    burstAt(field, field.nodes[2]);

    // Each arm waits its own turn, and the first does not wait at all: `p` is
    // the head's progress, so a negative one is an arm still on the launch pad.
    const departures = field.signals.map((signal) => signal.p);
    expect(new Set(departures).size).toBe(departures.length);
    expect(Math.max(...departures)).toBeCloseTo(0, 10);
    expect(Math.min(...departures)).toBeLessThan(0);
  });

  /**
   * An arm under the copy still fires and simply draws faint to invisible. An
   * arm that was not there would read as broken; one that dims reads as depth.
   * The cap is for ambient traffic, and a click is not ambient traffic.
   */
  it("fires every arm even where the copy has buried the edge", () => {
    const view = chain(5);
    const rects: Rect[] = [{ x: 0, y: 200, w: 1000, h: 200 }];
    const field = fieldOf(view, rects);
    // One frame, so the rolling refresh has measured at least one edge.
    run(field, 1);
    field.signals.length = 0;

    burstAt(field, field.nodes[2]);
    expect(field.signals).toHaveLength(2);
  });

  it("leaves an edge that is already carrying a signal alone", () => {
    const field = fieldOf(chain(5));
    burstAt(field, field.nodes[2]);
    const before = field.signals.length;
    burstAt(field, field.nodes[2]);

    expect(field.signals).toHaveLength(before);
  });
});

describe("hit testing", () => {
  it("finds the nearest node inside the hit radius and nothing outside it", () => {
    const field = fieldOf(chain(3));
    const target = field.nodes[1];

    expect(hitTest(field, target.x + 5, target.y + 5)?.node.id).toBe(
      target.node.id,
    );
    expect(hitTest(field, target.x, target.y - 200)).toBeNull();
  });

  /** An invisible node is not a clickable node. */
  it("skips a node the copy has faded out", () => {
    const node = screenNode({ id: "buried", screenX: 300, screenY: 300 });
    const view: GraphWindowView = {
      scale: VIEW_SCALE,
      centre: { x: 0, y: 0 },
      nodes: [node],
      edges: [],
    };
    const field = fieldOf(view, [{ x: 200, y: 200, w: 200, h: 200 }]);

    expect(field.nodes[0].clearance).toBeLessThanOrEqual(VISIBLE);
    expect(hitTest(field, 300, 300)).toBeNull();
  });
});

describe("reprojection and refetch", () => {
  /**
   * **Reproject, do not reset.** A resize re-derives every screen coordinate,
   * but the people did not change: node ids are stable for the life of a
   * response, so a signal keeps its progress and simply finds its edge in a new
   * place. Blanking the field because somebody dragged a window edge reads as a
   * glitch.
   */
  it("keeps a signal's progress across a reprojection", () => {
    const field = fieldOf(chain(6));
    run(field, 8);
    expect(field.signals.length).toBeGreaterThan(0);
    const before = field.signals.map((signal) => [signal.edgeKey, signal.p]);

    // The same graph window, projected somewhere else entirely.
    const moved = chain(6);
    for (const node of moved.nodes) {
      node.screenX += 240;
      node.screenY -= 80;
    }
    syncField(field, moved, [], 1200);

    expect(field.signals.map((signal) => [signal.edgeKey, signal.p])).toEqual(
      before,
    );
  });

  it("keeps a node's wander across a reprojection rather than snapping home", () => {
    const field = fieldOf(chain(4));
    run(field, 3);
    const offsets = field.nodes.map((n) => [
      n.x - n.node.screenX,
      n.y - n.node.screenY,
    ]);

    const moved = chain(4);
    for (const node of moved.nodes) node.screenX += 500;
    syncField(field, moved, [], 1200);

    // Compared to a tolerance rather than exactly: re-homing is one add and one
    // subtract in floating point, so the offset comes back the same wander to
    // within a fraction of a millipixel and not to the last bit.
    field.nodes.forEach((n, i) => {
      expect(n.x - n.node.screenX).toBeCloseTo(offsets[i][0], 9);
      expect(n.y - n.node.screenY).toBeCloseTo(offsets[i][1], 9);
    });
  });

  /**
   * A refetch is the other case, and it needs no branch of its own.
   * `graph.neighbourhood` mints `crypto.randomUUID()` per response, so a new
   * read means ids nothing recognises — and resuming across them would be
   * resuming onto strangers.
   */
  it("clears every signal when the read comes back with new ids", () => {
    const field = fieldOf(chain(6));
    run(field, 8);
    expect(field.signals.length).toBeGreaterThan(0);

    const refetched = chain(6);
    refetched.nodes.forEach((node, i) => {
      node.id = `fresh-${i}`;
    });
    syncField(field, refetched, [], 1200);

    expect(field.signals).toHaveLength(0);
    expect(field.nodes).toHaveLength(6);
  });

  it("empties out when the graph window goes away", () => {
    const field = fieldOf(chain(4));
    run(field, 5);
    syncField(field, null, [], 1200);

    expect(field.nodes).toHaveLength(0);
    expect(field.edges).toHaveLength(0);
    expect(field.signals).toHaveLength(0);
    expect(field.cap).toBe(0);
  });

  it("names an edge by its endpoints, so identity survives a reprojection", () => {
    const field = fieldOf(chain(3));
    expect(field.edges.map((edge) => edge.key)).toEqual([
      edgeKey("n0", "n1"),
      edgeKey("n1", "n2"),
    ]);
  });
});

describe("trail geometry", () => {
  /** The envelope: faint on departure, defined mid-flight, gone on arrival. */
  it("rises from nothing and returns to nothing", () => {
    expect(envelope(0)).toBe(0);
    expect(envelope(1)).toBe(0);
    expect(envelope(0.5)).toBeGreaterThan(0.5);
  });

  /** Every node signals; the tier picks the style and never whether it goes. */
  it("sends the default wake for an unconfigured node", () => {
    expect(trailStyleOf(screenNode({ signalStyle: "none" }))).toBe("default");
    expect(trailStyleOf(screenNode({ signalStyle: "comet" }))).toBe("comet");
  });

  /**
   * **The style is the wake and never the pace.**
   *
   * Head, speed and envelope are identical across all four, because nobody's
   * node may read as faster or more important than anybody else's. Given the
   * same edge, the same sender and the same progress, the four styles must
   * agree on where the head is and how bright it is, and differ only behind it.
   */
  it("puts the head in the same place, at the same brightness, for all four", () => {
    const heads = (["default", "comet", "fade", "dashed"] as const).map(
      (style) => {
        const field = fieldOf(chain(2, { signalStyle: "none" }));
        burstAt(field, field.nodes[0]);
        field.signals[0].style = style;
        field.signals[0].p = 0.5;
        const paint = signalPaint(field, field.signals[0]);
        if (!paint) throw new Error("expected a visible signal");
        return paint;
      },
    );

    for (const paint of heads.slice(1)) {
      expect(paint.headX).toBeCloseTo(heads[0].headX, 10);
      expect(paint.headY).toBeCloseTo(heads[0].headY, 10);
      expect(paint.halo).toEqual(heads[0].halo);
    }
  });

  it("gives each style the wake its name promises", () => {
    // A long edge on purpose. A wake is clamped to what the signal has actually
    // travelled — it may never run back past the node that sent it — so on a
    // short edge every style saturates at the same length and only the shape of
    // the wake tells them apart. The length difference needs room to show.
    const paintWith = (style: "default" | "comet" | "fade" | "dashed") => {
      const field = fieldOf(chain(2, {}, 600));
      burstAt(field, field.nodes[0]);
      field.signals[0].style = style;
      field.signals[0].p = 0.6;
      const paint = signalPaint(field, field.signals[0]);
      if (!paint) throw new Error("expected a visible signal");
      return paint;
    };

    // `fade` is rings dropped behind the head, and nothing stroked.
    const fade = paintWith("fade");
    expect(fade.strokes).toHaveLength(0);
    expect(fade.rings.length).toBeGreaterThan(1);
    const radii = fade.rings.map((ring) => ring.radius);
    expect(radii).toEqual([...radii].sort((a, b) => a - b));
    expect(Math.min(...radii)).toBeGreaterThan(NODE_RADIUS);

    // `dashed` is the same trail, stroked through a pattern.
    const dashed = paintWith("dashed");
    expect(dashed.dash).not.toBeNull();
    expect(dashed.rings).toHaveLength(0);
    expect(paintWith("default").dash).toBeNull();

    // `comet` is the same stroke, run further back.
    const comet = paintWith("comet");
    const plain = paintWith("default");
    expect(reach(comet)).toBeGreaterThan(reach(plain));
  });

  /** How far behind the head the furthest piece of a wake sits. */
  function reach(paint: {
    headX: number;
    headY: number;
    strokes: { fromX: number; fromY: number }[];
  }) {
    return Math.max(
      ...paint.strokes.map((stroke) =>
        Math.hypot(stroke.fromX - paint.headX, stroke.fromY - paint.headY),
      ),
    );
  }

  /**
   * A signal is faded by the clearance of the edge it is on, all the way to
   * not being drawn. This is the rule `routeClear` was written for in the
   * export and then never wired up.
   */
  it("does not draw a signal on an edge the copy has buried", () => {
    const view = chain(2);
    const field = fieldOf(view, [{ x: 0, y: 200, w: 1000, h: 200 }]);
    run(field, 1);
    burstAt(field, field.nodes[0]);
    field.signals[0].p = 0.5;

    expect(field.edges[0].clearance).toBeLessThanOrEqual(VISIBLE);
    expect(signalPaint(field, field.signals[0])).toBeNull();
  });

  /**
   * While a label is up the traffic fades back to about a quarter rather than
   * halting — but the viewer's own signals do not, because a burst from the dot
   * the page has just pointed at is the discovery moment, and dimming it would
   * be pointing and then looking away.
   */
  it("dims the field for a label, and exempts the viewer's own signals", () => {
    const build = (isViewer: boolean) => {
      const view = chain(2);
      view.nodes[0].isViewer = isViewer;
      const field = fieldOf(view);
      burstAt(field, field.nodes[0]);
      field.signals[0].p = 0.5;
      return field;
    };

    const stranger = build(false);
    const undimmed = signalPaint(stranger, stranger.signals[0]);
    const dimmed = signalPaint(stranger, stranger.signals[0], { dim: true });
    expect(dimmed?.halo[0].alpha).toBeLessThan(undimmed?.halo[0].alpha ?? 0);

    const viewer = build(true);
    expect(signalPaint(viewer, viewer.signals[0], { dim: true })).toEqual(
      signalPaint(viewer, viewer.signals[0]),
    );
  });

  /** A wake never runs off the end of the edge it is travelling along. */
  it("keeps the whole wake on its own edge", () => {
    const field = fieldOf(chain(2));
    burstAt(field, field.nodes[0]);
    const [from, to] = [field.edges[0].from, field.edges[0].to];
    const length = Math.hypot(to.x - from.x, to.y - from.y);

    for (let p = 0.05; p < 1; p += 0.05) {
      field.signals[0].p = p;
      const paint = signalPaint(field, field.signals[0]);
      if (!paint) continue;
      for (const stroke of paint.strokes) {
        const along = Math.hypot(stroke.fromX - from.x, stroke.fromY - from.y);
        expect(along).toBeGreaterThanOrEqual(-1e-9);
        expect(along).toBeLessThanOrEqual(length + 1e-9);
      }
    }
  });

  /**
   * A signal leaves the node that sent it, whichever end of the edge that is.
   *
   * A **backbone edge** is stored newer-to-older and drawn undirected, but a
   * signal has a sender: `spawnSignal` tosses for the end it leaves from and a
   * **burst** leaves from whichever node was clicked, which is as often the
   * edge's `to` as its `from`. Measuring progress from the view model's `from`
   * regardless draws half the traffic running backwards, out of a node that did
   * not send it — which is exactly the bug this pins.
   */
  it("travels away from its sender, not away from the edge's first endpoint", () => {
    const walk = (senderIndex: 0 | 1) => {
      const field = fieldOf(chain(2, {}, 600));
      burstAt(field, field.nodes[senderIndex]);
      const signal = field.signals[0];
      const sender = field.nodes[senderIndex];
      signal.p = 0.25;
      const near = signalPaint(field, signal);
      signal.p = 0.75;
      const far = signalPaint(field, signal);
      if (!near || !far) throw new Error("expected a visible signal");
      return {
        near: Math.hypot(near.headX - sender.x, near.headY - sender.y),
        far: Math.hypot(far.headX - sender.x, far.headY - sender.y),
      };
    };

    // Sent from the edge's `from`, and sent from its `to`: in both cases the
    // head is further from its own sender at 0.75 than it was at 0.25.
    for (const index of [0, 1] as const) {
      const { near, far } = walk(index);
      expect(far).toBeGreaterThan(near);
    }
  });

  /** A burst arm still waiting its turn is not on the canvas yet. */
  it("draws nothing for an arm that has not left", () => {
    const field = fieldOf(chain(4));
    burstAt(field, field.nodes[1]);
    const waiting = field.signals.find((signal) => signal.p < 0);
    expect(waiting).toBeDefined();
    if (waiting) expect(signalPaint(field, waiting)).toBeNull();
  });
});

describe("against a real projection", () => {
  /**
   * The fixtures above build a view by hand, which is right for asserting the
   * engine. This one goes through `projectGraphWindow` instead, so the two
   * halves are held together: a node the push placed is a node the field homes
   * on, and the drift is an overlay on the projection rather than a second
   * opinion about where anybody is.
   */
  it("homes every node on where the projection put it", () => {
    const view = projectGraphWindow({
      window: {
        centre: { x: 0, y: 0 },
        nodes: [
          {
            id: "a",
            x: 0,
            y: 0,
            color: "default",
            style: "default",
            signalStyle: "default",
            isViewer: true,
          },
          {
            id: "b",
            x: 220,
            y: 60,
            color: "default",
            style: "default",
            signalStyle: "comet",
            isViewer: false,
          },
        ],
        edges: [{ fromId: "a", toId: "b" }],
      },
      width: 1200,
      height: 600,
      keepOut: [{ x: 300, y: 100, w: 600, h: 200 }],
    });
    const field = fieldOf(view, [{ x: 300, y: 100, w: 600, h: 200 }]);

    expect(field.nodes.map((node) => [node.x, node.y])).toEqual(
      view.nodes.map((node) => [node.screenX, node.screenY]),
    );
    expect(field.edges).toHaveLength(1);
  });
});
