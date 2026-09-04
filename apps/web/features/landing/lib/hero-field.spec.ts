import { describe, expect, it } from "vitest";
import {
  buildField,
  clearAt,
  densityAt,
  distToContent,
  envelope,
  FEATHER,
  halton,
  hash,
  INSET,
  lineClear,
  quadPoint,
  type Rect,
  rgba,
} from "./hero-field";

const W = 1200;
const H = 600;
/** Roughly where the headline, the search field and the chips sit. */
const COPY: Rect[] = [
  { x: 300, y: 60, w: 600, h: 180 },
  { x: 320, y: 300, w: 560, h: 60 },
];

describe("halton", () => {
  it("spreads points over the unit interval without repeating", () => {
    const points = Array.from({ length: 64 }, (_, i) => halton(i, 2));
    expect(new Set(points).size).toBe(points.length);
    for (const p of points) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThan(1);
    }
  });

  it("fills both halves rather than marching up from zero", () => {
    const points = Array.from({ length: 16 }, (_, i) => halton(i, 2));
    expect(points.filter((p) => p < 0.5).length).toBeGreaterThan(4);
    expect(points.filter((p) => p >= 0.5).length).toBeGreaterThan(4);
  });
});

describe("hash", () => {
  it("is deterministic, so a relayout reproduces the same field", () => {
    expect(hash(7, 3)).toBe(hash(7, 3));
  });

  it("stays in the unit interval", () => {
    for (let i = 0; i < 50; i++) {
      expect(hash(i, 1)).toBeGreaterThanOrEqual(0);
      expect(hash(i, 1)).toBeLessThan(1);
    }
  });
});

describe("clearAt", () => {
  it("is 0 inside the copy and 1 well away from it", () => {
    expect(clearAt(400, 100, COPY)).toBe(0);
    expect(clearAt(50, 550, COPY)).toBe(1);
  });

  it("eases rather than steps at the boundary", () => {
    const justOutside = clearAt(300 - FEATHER / 2, 150, COPY);
    expect(justOutside).toBeGreaterThan(0);
    expect(justOutside).toBeLessThan(1);
  });

  it("judges a dot by its edge, not its centre", () => {
    const x = 300 - FEATHER - 1;
    expect(clearAt(x, 150, COPY)).toBe(1);
    expect(clearAt(x, 150, COPY, 6)).toBeLessThan(1);
  });
});

describe("distToContent", () => {
  it("is 0 inside a rect and grows with distance outside it", () => {
    expect(distToContent(400, 100, COPY)).toBe(0);
    expect(distToContent(280, 150, COPY)).toBeCloseTo(20);
  });
});

describe("densityAt", () => {
  it("thins the field out near the copy", () => {
    expect(densityAt(310, 150, COPY)).toBeLessThan(densityAt(20, 580, COPY));
  });

  it("never drops to nothing, so the copy is not ringed by a bald patch", () => {
    expect(densityAt(400, 100, COPY)).toBeGreaterThan(0);
  });
});

describe("lineClear", () => {
  it("rejects a line that crosses the copy", () => {
    expect(lineClear({ x: 0, y: 150 }, { x: 1200, y: 150 }, COPY)).toBe(false);
  });

  it("accepts a line that passes well clear of it", () => {
    expect(lineClear({ x: 0, y: 580 }, { x: 1200, y: 580 }, COPY)).toBe(true);
  });
});

describe("envelope", () => {
  it("is faint at departure and gone on arrival", () => {
    expect(envelope(0)).toBe(0);
    expect(envelope(1)).toBe(0);
    expect(envelope(0.5)).toBeGreaterThan(0.5);
  });
});

describe("quadPoint", () => {
  const seg = { ax: 0, ay: 0, cx: 50, cy: 100, bx: 100, by: 0 };

  it("starts on a and ends on b", () => {
    expect(quadPoint(seg, 0)).toEqual({ x: 0, y: 0 });
    expect(quadPoint(seg, 1)).toEqual({ x: 100, y: 0 });
  });

  it("bows towards the control point in between", () => {
    expect(quadPoint(seg, 0.5).y).toBeGreaterThan(0);
  });
});

describe("rgba", () => {
  it("rounds the channels and clamps a negative alpha", () => {
    expect(rgba([23.4, 81.6, 166], 0.5)).toBe("rgba(23,82,166,0.500)");
    expect(rgba([0, 0, 0], -1)).toBe("rgba(0,0,0,0.000)");
  });
});

describe("buildField", () => {
  const field = buildField({ w: W, h: H, rects: COPY, count: 50 });
  const drawn = field.nodes.filter((n) => !n.offFrame);

  it("draws no dot on top of the hero copy", () => {
    for (const node of drawn) {
      expect(clearAt(node.x, node.y, COPY, node.r)).toBe(1);
    }
  });

  it("keeps every drawn dot inside the frame", () => {
    for (const node of drawn) {
      expect(node.x).toBeGreaterThanOrEqual(INSET);
      expect(node.x).toBeLessThanOrEqual(W - INSET);
      expect(node.y).toBeGreaterThanOrEqual(INSET);
      expect(node.y).toBeLessThanOrEqual(H - INSET);
    }
  });

  it("keeps every off-frame node outside it, so it is never drawn", () => {
    for (const node of field.nodes.filter((n) => n.offFrame)) {
      const inside =
        node.x > INSET &&
        node.x < W - INSET &&
        node.y > INSET &&
        node.y < H - INSET;
      expect(inside).toBe(false);
    }
  });

  it("draws no line across the copy", () => {
    for (const edge of field.edges) {
      expect(lineClear(edge.a, edge.b, COPY)).toBe(true);
    }
  });

  it("never links two off-frame nodes — neither end would be visible", () => {
    for (const edge of field.edges) {
      expect(edge.a.offFrame && edge.b.offFrame).toBe(false);
    }
  });

  it("respects every dot's own line quota", () => {
    for (const [node, edges] of field.byNode) {
      expect(edges.length).toBeLessThanOrEqual(node.quota);
    }
  });

  it("reproduces the same field for the same frame", () => {
    const again = buildField({ w: W, h: H, rects: COPY, count: 50 });
    expect(again.nodes.map((n) => [n.x, n.y])).toEqual(
      field.nodes.map((n) => [n.x, n.y]),
    );
  });

  it("picks two well-separated resting dots for reduced motion", () => {
    expect(field.glows.length).toBeLessThanOrEqual(2);
    if (field.glows.length === 2) {
      const [a, b] = field.glows;
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(200);
    }
  });

  it("carries fewer travelling signals on a narrow frame", () => {
    const narrow = buildField({ w: 400, h: H, rects: [], count: 20 });
    expect(narrow.maxSignals).toBeLessThan(field.maxSignals);
  });

  it("survives a frame with no room to place anything", () => {
    const covered = buildField({
      w: 300,
      h: 200,
      rects: [{ x: -100, y: -100, w: 500, h: 400 }],
      count: 30,
    });
    expect(covered.nodes.filter((n) => !n.offFrame)).toHaveLength(0);
  });
});
