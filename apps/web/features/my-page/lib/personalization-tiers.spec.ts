import { describe, expect, it } from "vitest";
import { personalizationTierRows } from "./personalization-tiers";

const unlockedKeys = (tier: number) =>
  personalizationTierRows(tier)
    .filter((row) => row.unlocked)
    .map((row) => row.key);

describe("personalizationTierRows", () => {
  it("always lists the three axes, in artboard order", () => {
    expect(personalizationTierRows(0).map((row) => row.key)).toEqual([
      "color",
      "style",
      "signalStyle",
    ]);
  });

  it("locks everything at tier 0, which is where every account is today", () => {
    expect(unlockedKeys(0)).toEqual([]);
  });

  it("unlocks each axis at its own tier and every axis below it", () => {
    expect(unlockedKeys(1)).toEqual(["color"]);
    expect(unlockedKeys(2)).toEqual(["color", "style"]);
    expect(unlockedKeys(3)).toEqual(["color", "style", "signalStyle"]);
  });

  it("clamps a tier past the top rather than dropping rows", () => {
    expect(personalizationTierRows(9)).toHaveLength(3);
    expect(unlockedKeys(9)).toEqual(["color", "style", "signalStyle"]);
  });

  it("treats a negative or unusable tier as nothing unlocked", () => {
    expect(unlockedKeys(-2)).toEqual([]);
    expect(unlockedKeys(Number.NaN)).toEqual([]);
  });
});
