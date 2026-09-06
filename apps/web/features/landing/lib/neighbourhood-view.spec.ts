import { describe, expect, it } from "vitest";
// The real placement, not a stand-in: the property under test is that the
// golden-angle spacing `computeWorldPosition` produces survives the keep-out,
// so a synthetic field would be testing the wrong spiral.
import { computeWorldPosition } from "@/server/graph/placement";
import { clearAt, fallbackRects, MAX_PUSH, type Rect } from "./hero-keepout";
import {
  DEFAULT_NODE_COLOR_VAR,
  FALLBACK_NODE_COLOR_VAR,
  type GraphWindowInput,
  NODE_COLOR_VARS,
  NODE_RADIUS,
  nodeColorVar,
  pickViewportCentre,
  projectGraphWindow,
  VIEW_SCALE,
} from "./neighbourhood-view";

const WIDTH = 1000;
const HEIGHT = 600;

/** A block of copy across the top half, the way the hero headline sits. */
const COPY: Rect[] = [{ x: 200, y: 40, w: 600, h: 220 }];

/** Copy straight through the middle of the frame, as the rendered hero has. */
const BAND: Rect[] = [{ x: 100, y: 220, w: 800, h: 160 }];

/** Copy over the whole frame: nowhere on screen to stand, but an edge to leave by. */
const WALL: Rect[] = [{ x: 0, y: 0, w: WIDTH, h: HEIGHT }];

/** Copy past every edge of the frame: no way out inside the push budget either. */
const SMOTHER: Rect[] = [{ x: -400, y: -400, w: WIDTH + 800, h: HEIGHT + 800 }];

type NodeSpec = {
  id: string;
  x: number;
  y: number;
  color?: string;
  style?: string;
  signalStyle?: string;
  isViewer?: boolean;
};

function graphWindow(
  centre: { x: number; y: number },
  nodes: NodeSpec[],
  edges: { fromId: string; toId: string }[] = [],
): GraphWindowInput {
  return {
    centre,
    nodes: nodes.map((node) => ({
      id: node.id,
      x: node.x,
      y: node.y,
      color: node.color ?? "default",
      style: node.style ?? "default",
      signalStyle: node.signalStyle ?? "default",
      isViewer: node.isViewer ?? false,
    })),
    edges,
  };
}

function project(input: GraphWindowInput, keepOut: Rect[] = COPY) {
  return projectGraphWindow({
    window: input,
    width: WIDTH,
    height: HEIGHT,
    keepOut,
  });
}

/**
 * Where the projection alone would have put a node, before any keep-out.
 *
 * Derived from the anchor the view actually chose, so a test can ask "was this
 * node moved, and how far" without knowing where the anchor landed.
 */
function projectedOnto(
  view: { centre: { x: number; y: number } },
  windowCentre: { x: number; y: number },
  node: { x: number; y: number },
) {
  return {
    x: (node.x - windowCentre.x) * VIEW_SCALE + view.centre.x,
    y: (node.y - windowCentre.y) * VIEW_SCALE + view.centre.y,
  };
}

describe("nodeColorVar", () => {
  it("maps every colour the server can store onto a token", () => {
    for (const [name, variable] of Object.entries(NODE_COLOR_VARS)) {
      expect(nodeColorVar(name)).toBe(variable);
    }
  });

  // The column defaults to "default" and placement stores exactly that, so this
  // is the colour of every node in the community today.
  it("draws an unconfigured node in the brand blue", () => {
    expect(nodeColorVar("default")).toBe(DEFAULT_NODE_COLOR_VAR);
    expect(DEFAULT_NODE_COLOR_VAR).toBe("--cc-brand");
  });

  it("draws a name this build has never heard of as unconfigured", () => {
    expect(nodeColorVar("chartreuse")).toBe(FALLBACK_NODE_COLOR_VAR);
    expect(nodeColorVar("")).toBe(FALLBACK_NODE_COLOR_VAR);
  });

  // The server stores a name; a hex would mean someone inverted the contract.
  it("never trusts a hex value as a colour", () => {
    expect(nodeColorVar("#1751a6")).toBe(FALLBACK_NODE_COLOR_VAR);
  });

  it("keeps the six palette names out of the default, so none is assigned", () => {
    expect(Object.values(NODE_COLOR_VARS)).not.toContain(
      DEFAULT_NODE_COLOR_VAR,
    );
  });
});

/**
 * The anchor: where the middle of the graph sits on the canvas.
 *
 * Issue #68 settled that "the centre is the viewport centre" and this reverses
 * it, on the product owner's instruction. What made the earlier version a bug
 * was never the anchor — it was `fitScale`, which read the viewer's own
 * neighbourhood and zoomed two people differently. The anchor takes no viewer
 * and never did, which is what these tests are for.
 */
describe("pickViewportCentre", () => {
  it("takes no viewer, so it cannot be a function of one", () => {
    // Two calls with the same frame and copy, and nothing else to give it.
    expect(pickViewportCentre(WIDTH, HEIGHT, BAND)).toEqual(
      pickViewportCentre(WIDTH, HEIGHT, BAND),
    );
    expect(pickViewportCentre.length).toBe(3);
  });

  it("lands somewhere a node can actually be seen", () => {
    for (const keepOut of [COPY, BAND]) {
      const centre = pickViewportCentre(WIDTH, HEIGHT, keepOut);
      expect(clearAt(centre.x, centre.y, keepOut, NODE_RADIUS)).toBe(1);
    }
  });

  // The requirement, as a test: the viewer's dot may not sit in the middle of a
  // hero whose copy runs through the middle.
  it("moves off the middle of the frame when the copy runs through it", () => {
    const centre = pickViewportCentre(WIDTH, HEIGHT, BAND);
    expect(centre).not.toEqual({ x: WIDTH / 2, y: HEIGHT / 2 });
  });

  it("is the middle of the frame when there is no copy to clear", () => {
    expect(pickViewportCentre(WIDTH, HEIGHT, [])).toEqual({
      x: WIDTH / 2,
      y: HEIGHT / 2,
    });
  });

  /**
   * Clearance is a threshold, not a quantity. Scoring raw distance — which is
   * what the deleted version did — maximised into a corner on a wide frame and,
   * on a narrow one where nothing scores much, let the centrality pull win and
   * put the anchor inside the headline.
   */
  it("prefers a comfortable spot near the middle to the emptiest corner", () => {
    const centre = pickViewportCentre(WIDTH, HEIGHT, BAND);
    const corner = Math.min(
      Math.hypot(centre.x, centre.y),
      Math.hypot(WIDTH - centre.x, centre.y),
      Math.hypot(centre.x, HEIGHT - centre.y),
      Math.hypot(WIDTH - centre.x, HEIGHT - centre.y),
    );
    expect(corner).toBeGreaterThan(100);
  });

  /**
   * The smallest frame `hero-network.tsx` will size itself to, with the keep-out
   * it uses when it cannot measure the hero's own elements — which is exactly
   * what the component tests exercise under jsdom. A degenerate anchor there
   * would leave those tests asserting against a picture no browser ever draws.
   */
  it("is not degenerate on the smallest frame with the fallback keep-out", () => {
    const [w, h] = [320, 220];
    const centre = pickViewportCentre(w, h, fallbackRects(w, h));
    expect(clearAt(centre.x, centre.y, fallbackRects(w, h), NODE_RADIUS)).toBe(
      1,
    );
    expect(centre.x).toBeGreaterThan(0);
    expect(centre.x).toBeLessThan(w);
    expect(centre.y).toBeGreaterThan(0);
    expect(centre.y).toBeLessThan(h);
  });

  it("falls back to the middle when the copy leaves nowhere to stand", () => {
    for (const keepOut of [WALL, SMOTHER]) {
      expect(pickViewportCentre(WIDTH, HEIGHT, keepOut)).toEqual({
        x: WIDTH / 2,
        y: HEIGHT / 2,
      });
    }
  });
});

describe("projectGraphWindow", () => {
  const input = graphWindow(
    { x: 100, y: 100 },
    [
      { id: "me", x: 100, y: 100, isViewer: true },
      { id: "a", x: 400, y: 100, color: "moss" },
      { id: "b", x: 100, y: -200, color: "not-a-colour" },
    ],
    [
      { fromId: "a", toId: "me" },
      { fromId: "b", toId: "a" },
      // An edge to somebody outside the bounded set.
      { fromId: "a", toId: "elsewhere" },
    ],
  );

  /**
   * Requirement 4, and it costs nothing to get. `input.centre` **is** the
   * viewer's persisted world position, so their offset from it is zero and
   * their node lands on the anchor by identity — no search for their dot, no
   * special case, nothing stored. The anchor is deterministic for a given frame
   * and copy, so it is the same place next session.
   */
  it("lands the window's centre on the anchor, and the viewer with it", () => {
    const view = project(input, BAND);
    expect(view.centre).toEqual(pickViewportCentre(WIDTH, HEIGHT, BAND));
    const me = view.nodes.find((node) => node.isViewer);
    expect(me?.screenX).toBeCloseTo(view.centre.x);
    expect(me?.screenY).toBeCloseTo(view.centre.y);
    // And it is genuinely on screen rather than merely exempted from the fade.
    expect(me?.clearance).toBe(1);
  });

  // The anchor moves the camera and the camera alone. It is chosen from the
  // frame and the copy, and there is nothing about the graph it could read.
  it("picks the anchor from the frame and the copy, never from the graph", () => {
    const elsewhere = graphWindow({ x: 40000, y: -9000 }, [
      { id: "far", x: 40000, y: -9000, isViewer: true },
    ]);
    const empty = graphWindow({ x: 0, y: 0 }, []);
    for (const candidate of [elsewhere, empty, input]) {
      expect(project(candidate, BAND).centre).toEqual(
        pickViewportCentre(WIDTH, HEIGHT, BAND),
      );
    }
  });

  it("places everyone relative to the centre, in world units times the scale", () => {
    const view = project(input);
    const a = view.nodes.find((node) => node.id === "a");
    expect(a?.screenX).toBeCloseTo(300 * VIEW_SCALE + view.centre.x);
    expect(a?.screenY).toBeCloseTo(view.centre.y);
  });

  it("uses the constant scale, whatever the window contains", () => {
    const tight = graphWindow({ x: 0, y: 0 }, [
      { id: "me", x: 0, y: 0, isViewer: true },
      { id: "near", x: 1, y: 1 },
    ]);
    const sprawling = graphWindow({ x: 0, y: 0 }, [
      { id: "me", x: 0, y: 0, isViewer: true },
      { id: "far", x: 40000, y: -9000 },
    ]);
    const alone = graphWindow({ x: 0, y: 0 }, [
      { id: "me", x: 0, y: 0, isViewer: true },
    ]);

    for (const candidate of [tight, sprawling, alone, input]) {
      expect(project(candidate).scale).toBe(VIEW_SCALE);
    }
  });

  /**
   * The reported bug, as a test. Two members whose neighbourhoods overlap are
   * looking at one community: the dots they share must sit the same distance
   * and the same direction apart on both screens, however differently their own
   * bounded sets were cut.
   *
   * The anchor is provably safe for this — `screen(p) − screen(q) = (p − q)·s`,
   * in which both the window centre and the anchor cancel — and the constant
   * scale is what made it true. `pushClear` is the one thing here that is not
   * affine, so this fixture is deliberately laid out in the open, where the push
   * is the identity. `bounds what the push can cost two viewers` below is the
   * other half of the story, and the two together are the whole of it.
   */
  it("shows two viewers in one region the same graph", () => {
    // The same three world positions, read by two different people. Each read
    // is centred on its own viewer and hands back its own opaque ids, and one
    // of the two also sees a distant node the other does not.
    const ida = graphWindow({ x: 0, y: 0 }, [
      { id: "ida-self", x: 0, y: 0, isViewer: true },
      { id: "ida-sees-otto", x: 180, y: -30 },
      { id: "ida-sees-vera", x: -90, y: 240 },
    ]);
    const otto = graphWindow({ x: 180, y: -30 }, [
      { id: "otto-self", x: 180, y: -30, isViewer: true },
      { id: "otto-sees-ida", x: 0, y: 0 },
      { id: "otto-sees-vera", x: -90, y: 240 },
      { id: "otto-sees-a-stranger", x: 900, y: 900 },
    ]);

    const fromIda = project(ida);
    const fromOtto = project(otto);
    const gap = (view: ReturnType<typeof project>, a: string, b: string) => {
      const from = view.nodes.find((node) => node.id === a);
      const to = view.nodes.find((node) => node.id === b);
      if (!from || !to) throw new Error(`${a} or ${b} was not projected`);
      return [to.screenX - from.screenX, to.screenY - from.screenY];
    };

    const same = (a: number[], b: number[]) => {
      expect(a[0]).toBeCloseTo(b[0], 9);
      expect(a[1]).toBeCloseTo(b[1], 9);
    };
    same(
      gap(fromIda, "ida-self", "ida-sees-otto"),
      gap(fromOtto, "otto-sees-ida", "otto-self"),
    );
    same(
      gap(fromIda, "ida-sees-otto", "ida-sees-vera"),
      gap(fromOtto, "otto-self", "otto-sees-vera"),
    );
    // Nothing here was pushed, which is why the agreement above is exact.
    for (const view of [fromIda, fromOtto]) {
      const windowCentre = view === fromIda ? ida.centre : otto.centre;
      const source = view === fromIda ? ida : otto;
      for (const node of view.nodes) {
        const world = source.nodes.find((n) => n.id === node.id);
        if (!world) throw new Error(`${node.id} was not projected`);
        const before = projectedOnto(view, windowCentre, world);
        expect(node.screenX).toBeCloseTo(before.x, 9);
        expect(node.screenY).toBeCloseTo(before.y, 9);
      }
    }
  });

  /**
   * Where the agreement stops, stated rather than hidden.
   *
   * Hard clearance, a per-viewer camera and identical relative geometry are a
   * trilemma: any two are achievable. This resolves it by noticing that
   * `pushClear` is the identity wherever `clearAt` is already 1, so the only
   * nodes it can disagree about are ones that are **not drawn at all today** —
   * it degrades them from invisible to visible and displaced, by at most
   * `MAX_PUSH`. That is the trade, and it is worth measuring rather than
   * asserting.
   */
  it("bounds what the push can cost two viewers who share a node", () => {
    const world = { x: 0, y: 260 };
    const ida = graphWindow({ x: 0, y: 0 }, [
      { id: "ida-self", x: 0, y: 0, isViewer: true },
      { id: "ida-sees-them", ...world },
    ]);
    const vera = graphWindow({ x: 0, y: 190 }, [
      { id: "vera-self", x: 0, y: 190, isViewer: true },
      { id: "vera-sees-them", ...world },
    ]);

    const fromIda = project(ida, BAND);
    const fromVera = project(vera, BAND);
    const seen = (view: ReturnType<typeof project>, id: string) => {
      const node = view.nodes.find((n) => n.id === id);
      if (!node) throw new Error(`${id} was not projected`);
      return node;
    };

    // Same anchor, same scale: only the push can separate the two readings of
    // one world position, and only ever inside the budget.
    expect(fromIda.centre).toEqual(fromVera.centre);
    const a = seen(fromIda, "ida-sees-them");
    const b = seen(fromVera, "vera-sees-them");
    const projectedA = projectedOnto(fromIda, ida.centre, world);
    const projectedB = projectedOnto(fromVera, vera.centre, world);
    for (const [placed, before] of [
      [a, projectedA],
      [b, projectedB],
    ] as const) {
      expect(
        Math.hypot(placed.screenX - before.x, placed.screenY - before.y),
      ).toBeLessThanOrEqual(MAX_PUSH);
    }
    // And whatever the push did, nobody is left under the copy being faded to
    // nothing where there was room to stand.
    expect(a.clearance).toBe(1);
    expect(b.clearance).toBe(1);
  });

  it("marks exactly one node as the viewer's, and only when the read had one", () => {
    expect(project(input).nodes.filter((node) => node.isViewer)).toHaveLength(
      1,
    );

    const publicWindow = graphWindow({ x: 0, y: 0 }, [
      { id: "one", x: 0, y: 0 },
      { id: "two", x: 120, y: 0 },
    ]);
    expect(project(publicWindow).nodes.some((node) => node.isViewer)).toBe(
      false,
    );
  });

  it("maps stored colour names onto tokens, falling back for unknown ones", () => {
    const view = project(input);
    expect(view.nodes.find((node) => node.id === "a")?.colorVar).toBe(
      NODE_COLOR_VARS.moss,
    );
    expect(view.nodes.find((node) => node.id === "b")?.colorVar).toBe(
      FALLBACK_NODE_COLOR_VAR,
    );
  });

  it("draws only the backbone edges whose two ends are both in the set", () => {
    const view = project(input);
    const ids = new Set(view.nodes.map((node) => node.id));
    expect(view.edges).toHaveLength(2);
    for (const edge of view.edges) {
      expect(ids.has(edge.from.id)).toBe(true);
      expect(ids.has(edge.to.id)).toBe(true);
    }
  });

  /**
   * Two endpoints in the open do not make a line that is: an edge between
   * neighbours either side of the headline runs straight through it. An edge
   * stays a fade — `pushClear` places nodes, and a line goes wherever the two
   * nodes it joins ended up.
   */
  it("fades an edge by the whole line, not by its two ends", () => {
    const spanning = graphWindow(
      { x: 0, y: 0 },
      [
        { id: "left", x: -600, y: 0 },
        { id: "right", x: 600, y: 0 },
      ],
      [{ fromId: "left", toId: "right" }],
    );
    // A full-height strip, so the line has to cross it wherever the anchor put
    // the two ends, and neither end is anywhere near it.
    const strip: Rect[] = [{ x: 460, y: 0, w: 80, h: HEIGHT }];
    const view = project(spanning, strip);
    const left = view.nodes.find((node) => node.id === "left");
    const right = view.nodes.find((node) => node.id === "right");

    expect(left?.screenX).toBeLessThan(strip[0].x);
    expect(right?.screenX).toBeGreaterThan(strip[0].x + strip[0].w);
    expect(view.nodes.every((node) => node.clearance === 1)).toBe(true);
    expect(view.edges[0].clearance).toBe(0);
  });

  /**
   * The bug this branch exists to fix.
   *
   * The Landing artboard generates its field by rejection — a candidate whose
   * `clearAt` is below 1 is thrown away and another is tried — so the `clearAt`
   * it then multiplies into alpha is 1 for every dot it draws. The port kept
   * the multiplier and dropped the rejection, and nodes ended up under the
   * headline being faded to nothing rather than not being there. A projection
   * cannot reject a node, because every node is a person, so it moves it.
   */
  it("moves a node out from under the copy rather than only fading it", () => {
    const view = project(input, COPY);
    const b = view.nodes.find((node) => node.id === "b");
    const world = input.nodes.find((node) => node.id === "b");
    if (!b || !world) throw new Error("b was not projected");
    const before = projectedOnto(view, input.centre, world);

    // The projection alone would have put it under the copy, invisible.
    expect(clearAt(before.x, before.y, COPY, NODE_RADIUS)).toBe(0);
    // It is drawn instead, and drawn at full strength.
    expect(
      Math.hypot(b.screenX - before.x, b.screenY - before.y),
    ).toBeGreaterThan(0);
    expect(b.clearance).toBe(1);
  });

  it("clears the copy by at least the feather plus the dot's own radius", () => {
    for (const keepOut of [COPY, BAND]) {
      for (const node of project(input, keepOut).nodes) {
        expect(clearAt(node.screenX, node.screenY, keepOut, NODE_RADIUS)).toBe(
          1,
        );
      }
    }
  });

  it("never moves a node further than the push budget", () => {
    for (const keepOut of [COPY, BAND, WALL, SMOTHER]) {
      const view = project(input, keepOut);
      for (const node of view.nodes) {
        const world = input.nodes.find((n) => n.id === node.id);
        if (!world) throw new Error(`${node.id} was not projected`);
        const before = projectedOnto(view, input.centre, world);
        expect(
          Math.hypot(node.screenX - before.x, node.screenY - before.y),
        ).toBeLessThanOrEqual(MAX_PUSH);
      }
    }
  });

  /**
   * Off the edge is a legitimate place to go.
   *
   * The frame is a crop of a larger community — the artboard says so, and lines
   * running off it are how it reads that way — so a node near an edge with copy
   * over it leaves by that edge rather than being dragged back across the
   * headline. It is not drawn, which is the same outcome the fade produced, and
   * it costs a shorter move to get there.
   */
  it("lets a node leave by the frame edge when that is the nearest way out", () => {
    const view = project(input, WALL);
    const world = input.nodes.find((node) => node.id === "b");
    if (!world) throw new Error("b is missing");
    const before = projectedOnto(view, input.centre, world);
    const b = view.nodes.find((node) => node.id === "b");

    expect(before.y).toBeGreaterThan(0);
    expect(b?.screenY).toBeLessThan(0);
    expect(b?.clearance).toBe(1);
  });

  /**
   * The fade is still the backstop, and this is the case it backstops. Copy
   * reaching past every edge leaves nowhere to put anybody within `MAX_PUSH`:
   * the push declines rather than dragging a node somewhere no better, and every
   * node stays exactly where the projection put it and fades, which is what this
   * file did for everyone before.
   */
  it("falls back to fading when the copy leaves nowhere to move to", () => {
    const covered = project(input, SMOTHER);
    const open = project(input, []);

    expect(covered.centre).toEqual(open.centre);
    expect(covered.nodes.map((node) => [node.screenX, node.screenY])).toEqual(
      open.nodes.map((node) => [node.screenX, node.screenY]),
    );
    for (const node of covered.nodes) expect(node.clearance).toBe(0);
  });

  /**
   * The viewer's exemption is gone, and this is what replaces it.
   *
   * It used to be `clearance: node.isViewer ? 1 : clearAt(...)`, because the
   * viewer's node sat on the viewport centre and the viewport centre is where
   * the headline is. The anchor puts them somewhere legible instead, so there is
   * nothing left for an exemption to protect — and a hero with no legible place
   * at all now hides them along with everybody else, rather than drawing one dot
   * over the headline and calling it a reveal.
   */
  it("gives the viewer no exemption from the fade, having no need to", () => {
    expect(project(input, BAND).nodes.find((n) => n.isViewer)?.clearance).toBe(
      1,
    );
    expect(
      project(input, SMOTHER).nodes.find((n) => n.isViewer)?.clearance,
    ).toBe(0);
  });

  it("draws an empty community as an empty canvas, inventing nobody", () => {
    const view = project(graphWindow({ x: 0, y: 0 }, []));
    expect(view.nodes).toEqual([]);
    expect(view.edges).toEqual([]);
    expect(view.centre).toEqual(pickViewportCentre(WIDTH, HEIGHT, COPY));
  });

  // The projection is derived per frame and thrown away. If it ever mutated its
  // input, a projected pixel could find its way back to the server.
  it("leaves the world positions it was given untouched", () => {
    const before = structuredClone(input);
    project(input);
    expect(input).toEqual(before);
  });

  it("keeps world units out of the result — only screen positions come back", () => {
    for (const node of project(input).nodes) {
      expect(Object.keys(node).sort()).toEqual([
        "clearance",
        "colorVar",
        "id",
        "isViewer",
        "screenX",
        "screenY",
        "signalStyle",
        "style",
      ]);
    }
  });
});

/**
 * Every node is somebody, and two people drawn on top of each other read as one
 * person. Nothing asserted this: the suite proved each node was clear of the
 * *copy*, and nothing proved the nodes were clear of *each other*.
 *
 * They are held apart by `computeWorldPosition`'s golden angle, which is an
 * angular property — so a keep-out push that discards bearing discards the
 * spacing with it. The axis-only push did: it sent every point it moved to one
 * of four lines per rect, and a column of nodes under one rect came out as a
 * row. `pushClear` now leaves along the ray from the view's anchor, and this is
 * what says so from the outside.
 */
describe("nodes are drawn clear of each other, not only of the copy", () => {
  function sunflower(n: number) {
    return Array.from({ length: n }, (_, i) => {
      const at = computeWorldPosition(`user-${i}`, i);
      return { id: `n${i}`, x: at.x, y: at.y };
    });
  }

  function closestPairOnScreen(nodes: { screenX: number; screenY: number }[]) {
    let min = Number.POSITIVE_INFINITY;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        min = Math.min(
          min,
          Math.hypot(
            nodes[i].screenX - nodes[j].screenX,
            nodes[i].screenY - nodes[j].screenY,
          ),
        );
      }
    }
    return min;
  }

  /**
   * Two node centres closer than a diameter overlap on the canvas. That is the
   * floor this guards, not a spacing target — the real separations are 30px and
   * up, and asserting those would fail on the next unrelated layout change.
   */
  const MIN_SEPARATION = NODE_RADIUS * 2;

  for (const n of [3, 10, 150]) {
    it(`keeps ${n} drawn nodes at least a diameter apart`, () => {
      for (const keepOut of [COPY, BAND]) {
        const view = project(
          graphWindow({ x: 0, y: 0 }, sunflower(n)),
          keepOut,
        );
        const drawn = view.nodes.filter(
          (node) =>
            node.clearance > 0 &&
            node.screenX >= 0 &&
            node.screenX <= WIDTH &&
            node.screenY >= 0 &&
            node.screenY <= HEIGHT,
        );
        if (drawn.length < 2) continue;
        expect(closestPairOnScreen(drawn)).toBeGreaterThanOrEqual(
          MIN_SEPARATION,
        );
      }
    });
  }

  /**
   * The push is what this is about, so it has to be the push that is exercised.
   * A suite where nothing was ever moved would pass the separation assertion
   * above while proving nothing.
   */
  it("actually moves some of them, or the assertion above is vacuous", () => {
    const input = graphWindow({ x: 0, y: 0 }, sunflower(150));
    const view = project(input, COPY);
    const moved = view.nodes.filter((node) => {
      const raw = projectedOnto(view, input.centre, {
        x: input.nodes.find((n) => n.id === node.id)?.x ?? 0,
        y: input.nodes.find((n) => n.id === node.id)?.y ?? 0,
      });
      return Math.hypot(node.screenX - raw.x, node.screenY - raw.y) > 0.01;
    });
    expect(moved.length).toBeGreaterThan(0);
  });
});
