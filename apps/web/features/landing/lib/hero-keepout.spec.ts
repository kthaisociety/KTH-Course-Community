import { describe, expect, it } from "vitest";
import {
  clearAt,
  FEATHER,
  fallbackRects,
  lineClearance,
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
