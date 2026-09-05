import { describe, expect, it } from "vitest";
import { PERSONALIZATION_AXES } from "@/server/graph/appearance";
import { personalizationTierRows, UNCONFIGURED } from "./personalization-tiers";

/** An account that has never gone quiet: earned and effective are the same. */
const unlockedKeys = (tier: number) =>
  personalizationTierRows(tier, tier)
    .filter((row) => row.unlocked)
    .map((row) => row.key);

const statesAt = (earned: number, effective: number) =>
  personalizationTierRows(earned, effective).map((row) => row.state);

describe("personalizationTierRows", () => {
  it("always lists the three axes, in artboard order", () => {
    expect(personalizationTierRows(0, 0).map((row) => row.key)).toEqual([
      "color",
      "style",
      "signalStyle",
    ]);
  });

  it("locks everything at tier 0", () => {
    expect(unlockedKeys(0)).toEqual([]);
  });

  it("unlocks each axis at its own tier and every axis below it", () => {
    expect(unlockedKeys(1)).toEqual(["color"]);
    expect(unlockedKeys(2)).toEqual(["color", "style"]);
    expect(unlockedKeys(3)).toEqual(["color", "style", "signalStyle"]);
  });

  it("clamps a tier past the top rather than dropping rows", () => {
    expect(personalizationTierRows(9, 9)).toHaveLength(3);
    expect(unlockedKeys(9)).toEqual(["color", "style", "signalStyle"]);
  });

  it("treats a negative or unusable tier as nothing unlocked", () => {
    expect(unlockedKeys(-2)).toEqual([]);
    expect(unlockedKeys(Number.NaN)).toEqual([]);
  });

  /**
   * The reason this function takes two numbers. Somebody who reached tier 3 and
   * then went quiet has earned all three axes and can edit none of them; the row
   * that says "Locked" there is claiming they never had it, which the column
   * contradicts.
   */
  it("calls an earned-but-decayed axis dormant, not locked", () => {
    expect(statesAt(3, 1)).toEqual(["unlocked", "dormant", "dormant"]);
    expect(statesAt(3, 0)).toEqual(["dormant", "dormant", "dormant"]);
  });

  it("still calls an axis that was never earned locked", () => {
    expect(statesAt(1, 1)).toEqual(["unlocked", "locked", "locked"]);
    expect(statesAt(0, 0)).toEqual(["locked", "locked", "locked"]);
  });

  // An effective tier above the earned one is not a state the server produces —
  // `deriveEffectiveTier` clamps to `[0, earned]` — but the rows are rendered on
  // somebody's own page and must not depend on that holding.
  it("never lets an effective tier above the earned one read as dormant", () => {
    expect(statesAt(0, 3)).toEqual(["unlocked", "unlocked", "unlocked"]);
  });

  it("offers the unconfigured state first on every axis", () => {
    for (const row of personalizationTierRows(3, 3)) {
      expect(row.options[0]).toBe(UNCONFIGURED);
    }
  });

  /**
   * The rows are the server's table, not a copy of it. A second list would let
   * the picker offer something `setNodeAppearance` refuses, which is the exact
   * failure the shared module exists to make impossible.
   */
  it("renders the same axes the server gates on, option for option", () => {
    const rows = personalizationTierRows(3, 3);
    expect(rows.map((row) => row.tier)).toEqual(
      PERSONALIZATION_AXES.map((axis) => axis.tier),
    );
    for (const [index, axis] of PERSONALIZATION_AXES.entries()) {
      expect(rows[index].key).toBe(axis.key);
      expect(rows[index].options).toEqual([UNCONFIGURED, ...axis.options]);
    }
  });
});
