import { describe, expect, it } from "vitest";
import {
  clearAt,
  distToContent,
  FEATHER,
  fallbackRects,
  lineClearance,
  MAX_PUSH,
  pushClear,
  type Rect,
} from "./hero-keepout";

const W = 1200;
const H = 600;
/** Roughly where the headline, the search field and the chips sit. */
const COPY: Rect[] = [
  { x: 300, y: 60, w: 600, h: 180 },
  { x: 320, y: 300, w: 560, h: 60 },
];

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

  it("is 1 everywhere when the hero has no copy to keep clear of", () => {
    expect(clearAt(400, 100, [])).toBe(1);
  });
});

describe("distToContent", () => {
  it("is 0 inside the copy and grows with the gap outside it", () => {
    expect(distToContent(400, 100, COPY)).toBe(0);
    expect(distToContent(300 - 40, 150, COPY)).toBeCloseTo(40);
  });

  // `clearAt` saturates at FEATHER, so it cannot rank two clear points. This is
  // what picking a viewport anchor needs and why both functions exist.
  it("ranks two points that clearAt calls equally clear", () => {
    expect(clearAt(200, 150, COPY)).toBe(clearAt(50, 150, COPY));
    expect(distToContent(50, 150, COPY)).toBeGreaterThan(
      distToContent(200, 150, COPY),
    );
  });
});

/**
 * The rejection the artboard does by trying again, as a move.
 *
 * The Landing artboard throws a candidate placement away when
 * `clearAt(x, y, 5) < 1` and generates another, so every dot it draws is
 * genuinely clear of the copy and the `clearAt` it multiplies into alpha is 1
 * for all of them. A projection of the real graph cannot throw a placement
 * away — every node in the window is a person — so it walks the point out
 * instead. These are the guarantees the rest of the hero is allowed to assume.
 */
describe("pushClear", () => {
  const RADIUS = 4;
  const moved = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  it("is the identity wherever the point is already clear", () => {
    const open = { x: 50, y: 550 };
    expect(clearAt(open.x, open.y, COPY, RADIUS)).toBe(1);
    expect(pushClear(open.x, open.y, COPY, RADIUS)).toEqual(open);
  });

  // The post-condition the fade used to stand in for, and the reason the viewer
  // exemption in the projection could be deleted.
  it("leaves every point it moves fully clear of the copy", () => {
    for (let x = 280; x <= 920; x += 20) {
      for (let y = 40; y <= 380; y += 20) {
        const out = pushClear(x, y, COPY, RADIUS);
        if (moved(out, { x, y }) === 0) continue;
        expect(clearAt(out.x, out.y, COPY, RADIUS)).toBe(1);
      }
    }
  });

  it("leaves by the nearest wall, so a node stays beside the copy it was under", () => {
    // 20px inside the left edge of the first rect, and a long way from the top.
    const out = pushClear(320, 150, COPY, RADIUS);
    expect(out.y).toBe(150);
    expect(out.x).toBeLessThan(300 - FEATHER - RADIUS + 1e-3);
    expect(moved(out, { x: 320, y: 150 })).toBeLessThan(40);
  });

  it("judges the point by its edge, so a bigger dot is pushed further", () => {
    const small = pushClear(320, 150, COPY, 0);
    const large = pushClear(320, 150, COPY, 12);
    expect(320 - large.x).toBeGreaterThan(320 - small.x);
  });

  it("never travels further than MAX_PUSH", () => {
    for (let x = 0; x <= 1200; x += 25) {
      for (let y = 0; y <= 600; y += 25) {
        expect(
          moved(pushClear(x, y, COPY, RADIUS), { x, y }),
        ).toBeLessThanOrEqual(MAX_PUSH);
      }
    }
  });

  /**
   * The other half of the two-valued contract. A point with no way out inside
   * the budget is handed back exactly as it came, so the caller's fade is still
   * looking at the position the projection produced rather than at a node
   * dragged halfway across the hero and left visible under the headline anyway.
   */
  it("gives up rather than teleport, when the copy covers everything", () => {
    const wall: Rect[] = [{ x: 0, y: 0, w: 1200, h: 600 }];
    const inside = { x: 600, y: 300 };
    expect(pushClear(inside.x, inside.y, wall, RADIUS)).toEqual(inside);
    expect(clearAt(inside.x, inside.y, wall, RADIUS)).toBe(0);
  });

  // Both branches, so an anchor that has already been pushed is not pushed a
  // second time when a node lands on it.
  it("is idempotent", () => {
    const points = [
      { x: 320, y: 150 },
      { x: 600, y: 330 },
      { x: 50, y: 550 },
      { x: 600, y: 150 },
    ];
    for (const p of points) {
      const once = pushClear(p.x, p.y, COPY, RADIUS);
      expect(pushClear(once.x, once.y, COPY, RADIUS)).toEqual(once);
    }
  });

  /**
   * The case that rules out the obvious implementation.
   *
   * `SAFETY` pads every rect by 25px a side, so the headline's own lines overlap
   * each other by more than they are apart. Leaving each rect by its own nearest
   * wall bounces a point between two of them forever; scoring every candidate
   * against the whole set has no such fixed point, and this is that difference
   * as a test.
   */
  it("escapes a stack of overlapping rects rather than bouncing between them", () => {
    const stacked: Rect[] = [
      { x: 200, y: 100, w: 400, h: 60 },
      { x: 200, y: 150, w: 400, h: 60 },
      { x: 200, y: 200, w: 400, h: 60 },
    ];
    const out = pushClear(400, 180, stacked, RADIUS);
    expect(clearAt(out.x, out.y, stacked, RADIUS)).toBe(1);
    expect(moved(out, { x: 400, y: 180 })).toBeLessThanOrEqual(MAX_PUSH);
  });

  it("has nothing to do when the hero has no copy to keep clear of", () => {
    expect(pushClear(400, 100, [], RADIUS)).toEqual({ x: 400, y: 100 });
  });
});

describe("lineClearance", () => {
  it("hides a line that crosses the copy", () => {
    expect(lineClearance({ x: 0, y: 150 }, { x: 1200, y: 150 }, COPY)).toBe(0);
  });

  it("leaves a line that passes well clear of it alone", () => {
    expect(lineClearance({ x: 0, y: 580 }, { x: 1200, y: 580 }, COPY)).toBe(1);
  });

  // Two endpoints in the open say nothing about the middle: a backbone edge
  // between neighbours either side of the headline runs straight through it.
  it("judges the whole line, not its two ends", () => {
    const left = { x: 280, y: 150 };
    const right = { x: 920, y: 150 };
    expect(clearAt(left.x, left.y, COPY)).toBe(1);
    expect(clearAt(right.x, right.y, COPY)).toBe(1);
    expect(lineClearance(left, right, COPY)).toBe(0);
  });
});

describe("fallbackRects", () => {
  it("reserves the middle of the frame when nothing could be measured", () => {
    const rects = fallbackRects(W, H);
    expect(rects.length).toBeGreaterThan(0);
    expect(clearAt(W / 2, H / 2, rects)).toBe(0);
  });

  it("leaves the corners usable", () => {
    expect(clearAt(10, H - 10, fallbackRects(W, H))).toBe(1);
  });
});
