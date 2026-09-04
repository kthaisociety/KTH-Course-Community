import { describe, expect, it } from "vitest";
import type { Rect } from "./hero-field";
import {
  DEFAULT_SCALE,
  FALLBACK_NODE_COLOR_VAR,
  fitScale,
  MAX_SCALE,
  type NeighbourhoodInput,
  NODE_COLOR_VARS,
  nodeColorVar,
  pickViewportCentre,
  projectNeighbourhood,
} from "./neighbourhood-view";

const WIDTH = 1000;
const HEIGHT = 600;

/** A block of copy across the top half, the way the hero headline sits. */
const COPY: Rect[] = [{ x: 200, y: 40, w: 600, h: 220 }];

function neighbourhood(
  nodes: { userId: string; x: number; y: number; color?: string }[],
  edges: { nodeUserId: string; anchorUserId: string }[] = [],
): NeighbourhoodInput {
  const [viewer] = nodes;
  return {
    viewer: { userId: viewer.userId, x: viewer.x, y: viewer.y },
    nodes: nodes.map((n) => ({ ...n, color: n.color ?? "frost" })),
    edges,
  };
}

describe("nodeColorVar", () => {
  it("maps every colour the server can store onto a token", () => {
    for (const [name, variable] of Object.entries(NODE_COLOR_VARS)) {
      expect(nodeColorVar(name)).toBe(variable);
    }
  });

  it("draws a name this build has never heard of in the neutral", () => {
    expect(nodeColorVar("chartreuse")).toBe(FALLBACK_NODE_COLOR_VAR);
    expect(nodeColorVar("")).toBe(FALLBACK_NODE_COLOR_VAR);
  });

  // The server stores a name; a hex would mean someone inverted the contract.
  it("never trusts a hex value as a colour", () => {
    expect(nodeColorVar("#1751a6")).toBe(FALLBACK_NODE_COLOR_VAR);
  });
});

describe("pickViewportCentre", () => {
  it("keeps the viewer's node out of the hero copy", () => {
    const centre = pickViewportCentre(WIDTH, HEIGHT, COPY);
    const insideCopy =
      centre.x > COPY[0].x &&
      centre.x < COPY[0].x + COPY[0].w &&
      centre.y > COPY[0].y &&
      centre.y < COPY[0].y + COPY[0].h;
    expect(insideCopy).toBe(false);
  });

  it("stays inside the frame", () => {
    const centre = pickViewportCentre(WIDTH, HEIGHT, COPY);
    expect(centre.x).toBeGreaterThan(0);
    expect(centre.x).toBeLessThan(WIDTH);
    expect(centre.y).toBeGreaterThan(0);
    expect(centre.y).toBeLessThan(HEIGHT);
  });

  it("takes the middle when nothing is in the way", () => {
    expect(pickViewportCentre(WIDTH, HEIGHT, [])).toEqual({ x: 500, y: 300 });
  });

  it("is deterministic — the same frame gives the same centre", () => {
    expect(pickViewportCentre(WIDTH, HEIGHT, COPY)).toEqual(
      pickViewportCentre(WIDTH, HEIGHT, COPY),
    );
  });
});

describe("fitScale", () => {
  const centre = { x: 500, y: 300 };

  it("brings the furthest node inside the frame", () => {
    const input = neighbourhood([
      { userId: "me", x: 0, y: 0 },
      { userId: "far", x: 4000, y: 0 },
    ]);
    const scale = fitScale(input, WIDTH, HEIGHT, centre);
    expect(4000 * scale + centre.x).toBeLessThanOrEqual(WIDTH);
  });

  it("fits each direction separately, because the centre is rarely central", () => {
    const input = neighbourhood([
      { userId: "me", x: 0, y: 0 },
      { userId: "left", x: -1000, y: 0 },
    ]);
    const offCentre = { x: 200, y: 300 };
    const scale = fitScale(input, WIDTH, HEIGHT, offCentre);
    expect(offCentre.x - 1000 * scale).toBeGreaterThanOrEqual(0);
  });

  it("does not magnify a tight neighbourhood past the cap", () => {
    const input = neighbourhood([
      { userId: "me", x: 0, y: 0 },
      { userId: "close", x: 1, y: 1 },
    ]);
    expect(fitScale(input, WIDTH, HEIGHT, centre)).toBe(MAX_SCALE);
  });

  it("has nothing to measure when the viewer is alone", () => {
    const input = neighbourhood([{ userId: "me", x: 0, y: 0 }]);
    expect(fitScale(input, WIDTH, HEIGHT, centre)).toBe(DEFAULT_SCALE);
  });
});

describe("projectNeighbourhood", () => {
  const input = neighbourhood(
    [
      { userId: "me", x: 100, y: 100, color: "violet" },
      { userId: "a", x: 400, y: 100, color: "moss" },
      { userId: "b", x: 100, y: -200, color: "not-a-colour" },
    ],
    [
      { nodeUserId: "a", anchorUserId: "me" },
      { nodeUserId: "b", anchorUserId: "a" },
      // An edge to somebody outside the bounded set.
      { nodeUserId: "a", anchorUserId: "elsewhere" },
    ],
  );

  const view = () =>
    projectNeighbourhood({
      neighbourhood: input,
      width: WIDTH,
      height: HEIGHT,
      keepOut: COPY,
    });

  it("puts the viewer's own node exactly on the chosen centre", () => {
    const projected = view();
    const me = projected.nodes.find((n) => n.isViewer);
    expect(me?.screenX).toBeCloseTo(projected.centre.x);
    expect(me?.screenY).toBeCloseTo(projected.centre.y);
  });

  it("places everyone else relative to the viewer, in world units times scale", () => {
    const projected = view();
    const a = projected.nodes.find((n) => n.userId === "a");
    expect(a?.screenX).toBeCloseTo(300 * projected.scale + projected.centre.x);
    expect(a?.screenY).toBeCloseTo(projected.centre.y);
  });

  it("marks exactly one node as the viewer's", () => {
    expect(view().nodes.filter((n) => n.isViewer)).toHaveLength(1);
  });

  it("maps stored colour names onto tokens, falling back for unknown ones", () => {
    const projected = view();
    expect(projected.nodes.find((n) => n.userId === "me")?.colorVar).toBe(
      NODE_COLOR_VARS.violet,
    );
    expect(projected.nodes.find((n) => n.userId === "b")?.colorVar).toBe(
      FALLBACK_NODE_COLOR_VAR,
    );
  });

  it("draws only the backbone edges whose two ends are both in the set", () => {
    const edges = view().edges;
    expect(edges).toHaveLength(2);
    for (const [from, to] of edges) {
      expect(input.nodes.map((n) => n.userId)).toContain(from.userId);
      expect(input.nodes.map((n) => n.userId)).toContain(to.userId);
    }
  });

  it("never fades the node the whole flow exists to reveal", () => {
    const projected = projectNeighbourhood({
      neighbourhood: input,
      width: WIDTH,
      height: HEIGHT,
      // Copy covering the entire frame: everyone else is invisible, the viewer
      // is not.
      keepOut: [{ x: 0, y: 0, w: WIDTH, h: HEIGHT }],
    });
    const me = projected.nodes.find((n) => n.isViewer);
    expect(me?.clearance).toBe(1);
    for (const other of projected.nodes.filter((n) => !n.isViewer)) {
      expect(other.clearance).toBe(0);
    }
  });

  // The projection is derived per frame and thrown away. If it ever mutated its
  // input, a projected pixel could find its way back to the server.
  it("leaves the world positions it was given untouched", () => {
    const before = structuredClone(input);
    view();
    expect(input).toEqual(before);
  });

  it("keeps world units out of the result — only screen positions come back", () => {
    for (const node of view().nodes) {
      expect(Object.keys(node).sort()).toEqual([
        "clearance",
        "colorVar",
        "isViewer",
        "screenX",
        "screenY",
        "userId",
      ]);
    }
  });
});
