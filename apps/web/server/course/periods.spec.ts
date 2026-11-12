import { describe, expect, it } from "vitest";
import { periodCredits } from "./periods";

describe("periodCredits", () => {
  it("reads credits per period, P0..P5", () => {
    expect(periodCredits("P3 (4,5 hp), P4 (3,0 hp)", 7.5)).toEqual([
      0, 0, 0, 4.5, 3, 0,
    ]);
  });

  it("shares what is left between periods printed without credits", () => {
    expect(periodCredits("P1, P2", 7.5)).toEqual([0, 3.75, 3.75, 0, 0, 0]);
  });

  it("returns null when nothing is printed", () => {
    expect(periodCredits(null, 7.5)).toBeNull();
    expect(periodCredits("", 7.5)).toBeNull();
  });
});
