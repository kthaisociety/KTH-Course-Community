import { describe, expect, it } from "vitest";
import type { Rect } from "./hero-keepout";
import {
  DEFAULT_NODE_COLOR_VAR,
  FALLBACK_NODE_COLOR_VAR,
  type GraphWindowInput,
  NODE_COLOR_VARS,
  nodeColorVar,
  projectGraphWindow,
  VIEW_SCALE,
} from "./neighbourhood-view";

const WIDTH = 1000;
const HEIGHT = 600;

/** A block of copy across the top half, the way the hero headline sits. */
const COPY: Rect[] = [{ x: 200, y: 40, w: 600, h: 220 }];

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

  it("puts the window's centre exactly on the middle of the frame", () => {
    const view = project(input);
    expect(view.centre).toEqual({ x: WIDTH / 2, y: HEIGHT / 2 });
    const me = view.nodes.find((node) => node.isViewer);
    expect(me?.screenX).toBeCloseTo(WIDTH / 2);
    expect(me?.screenY).toBeCloseTo(HEIGHT / 2);
  });

  // The camera used to be grid-searched for a gap in the hero copy, which made
  // it a function of the headline layout rather than of the viewer.
  it("does not move the camera for the copy", () => {
    const withCopy = project(input, COPY);
    const withNone = project(input, []);
    expect(withCopy.centre).toEqual(withNone.centre);
    expect(withCopy.nodes.map((node) => [node.screenX, node.screenY])).toEqual(
      withNone.nodes.map((node) => [node.screenX, node.screenY]),
    );
  });

  it("places everyone relative to the centre, in world units times the scale", () => {
    const view = project(input);
    const a = view.nodes.find((node) => node.id === "a");
    expect(a?.screenX).toBeCloseTo(300 * VIEW_SCALE + WIDTH / 2);
    expect(a?.screenY).toBeCloseTo(HEIGHT / 2);
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
   */
  it("shows two viewers in one region the same graph", () => {
    // The same three world positions, read by two different people. Each read
    // is centred on its own viewer and hands back its own opaque ids, and one
    // of the two also sees a distant node the other does not.
    const ida = graphWindow({ x: 0, y: 0 }, [
      { id: "ida-self", x: 0, y: 0, isViewer: true },
      { id: "ida-sees-otto", x: 180, y: -60 },
      { id: "ida-sees-vera", x: -90, y: 240 },
    ]);
    const otto = graphWindow({ x: 180, y: -60 }, [
      { id: "otto-self", x: 180, y: -60, isViewer: true },
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

  // Two endpoints in the open do not make a line that is: an edge between
  // neighbours either side of the headline runs straight through it.
  it("fades an edge by the whole line, not by its two ends", () => {
    const spanning = graphWindow(
      { x: 0, y: 0 },
      [
        { id: "left", x: -600, y: 0 },
        { id: "right", x: 600, y: 0 },
      ],
      [{ fromId: "left", toId: "right" }],
    );
    const across: Rect[] = [{ x: 400, y: 250, w: 200, h: 100 }];
    const view = project(spanning, across);

    expect(view.nodes.every((node) => node.clearance === 1)).toBe(true);
    expect(view.edges[0].clearance).toBe(0);
  });

  it("fades a node under the copy instead of moving it", () => {
    const covered = project(input, [{ x: 0, y: 0, w: WIDTH, h: HEIGHT }]);
    const open = project(input, []);

    for (const node of covered.nodes.filter((n) => !n.isViewer)) {
      expect(node.clearance).toBe(0);
    }
    expect(covered.nodes.map((node) => [node.screenX, node.screenY])).toEqual(
      open.nodes.map((node) => [node.screenX, node.screenY]),
    );
  });

  it("never fades the node the whole flow exists to reveal", () => {
    const covered = project(input, [{ x: 0, y: 0, w: WIDTH, h: HEIGHT }]);
    expect(covered.nodes.find((node) => node.isViewer)?.clearance).toBe(1);
  });

  it("draws an empty community as an empty canvas, inventing nobody", () => {
    const view = project(graphWindow({ x: 0, y: 0 }, []));
    expect(view.nodes).toEqual([]);
    expect(view.edges).toEqual([]);
    expect(view.centre).toEqual({ x: WIDTH / 2, y: HEIGHT / 2 });
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
