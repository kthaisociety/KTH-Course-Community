import { describe, expect, it } from "vitest";
import {
  chooseAnchorCount,
  computeWorldPosition,
  MAX_ANCHORS,
  MIN_ANCHORS,
  NODE_COLORS,
  pickNodeColor,
} from "./placement";

const ids = Array.from({ length: 300 }, (_, i) => `user-${i}`);
const radiusOf = (p: { x: number; y: number }) => Math.hypot(p.x, p.y);

describe("pickNodeColor", () => {
  it("gives the same app user the same colour every time", () => {
    expect(pickNodeColor("user-42")).toBe(pickNodeColor("user-42"));
  });

  it("only ever picks a name from the palette", () => {
    for (const id of ids) {
      expect(NODE_COLORS).toContain(pickNodeColor(id));
    }
  });

  it("uses the whole palette across a community", () => {
    const used = new Set(ids.map(pickNodeColor));

    expect(used.size).toBe(NODE_COLORS.length);
  });
});

describe("computeWorldPosition", () => {
  it("places the same app user in the same spot for a given community size", () => {
    expect(computeWorldPosition("user-7", 12)).toEqual(
      computeWorldPosition("user-7", 12),
    );
  });

  it("places each new node further out than the one before it", () => {
    for (let placed = 0; placed < 50; placed++) {
      expect(
        radiusOf(computeWorldPosition("user-7", placed + 1)),
      ).toBeGreaterThan(radiusOf(computeWorldPosition("user-7", placed)));
    }
  });

  it("puts the very first node at the centre of the world", () => {
    expect(radiusOf(computeWorldPosition("user-7", 0))).toBe(0);
  });

  it("separates two app users who join at the same community size", () => {
    const a = computeWorldPosition("user-a", 30);
    const b = computeWorldPosition("user-b", 30);

    expect(a).not.toEqual(b);
  });

  it("spreads a community around the origin rather than along one ray", () => {
    const angles = ids
      .slice(1, 60)
      .map((id, i) => computeWorldPosition(id, i + 1))
      .map((p) => Math.atan2(p.y, p.x));
    const quadrants = new Set(
      angles.map((a) =>
        Math.floor(((a + 2 * Math.PI) % (2 * Math.PI)) / (Math.PI / 2)),
      ),
    );

    expect(quadrants.size).toBe(4);
  });

  it("returns finite world units", () => {
    for (const [i, id] of ids.entries()) {
      const { x, y } = computeWorldPosition(id, i);
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
    }
  });
});

describe("chooseAnchorCount", () => {
  it("always asks for three to five anchors", () => {
    for (const id of ids) {
      const count = chooseAnchorCount(id);
      expect(count).toBeGreaterThanOrEqual(MIN_ANCHORS);
      expect(count).toBeLessThanOrEqual(MAX_ANCHORS);
    }
  });

  it("uses every count in the range across a community", () => {
    expect(new Set(ids.map(chooseAnchorCount)).size).toBe(
      MAX_ANCHORS - MIN_ANCHORS + 1,
    );
  });

  it("is stable for an app user", () => {
    expect(chooseAnchorCount("user-42")).toBe(chooseAnchorCount("user-42"));
  });
});
