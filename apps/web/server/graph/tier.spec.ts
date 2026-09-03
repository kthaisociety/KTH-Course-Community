import { describe, expect, it } from "vitest";
import { deriveEffectiveTier } from "./tier";

// Fixed dates only: deriveEffectiveTier is pure, so there is no clock to inject
// beyond its own `now` parameter.
const JOINED = new Date("2024-01-15T12:00:00.000Z");

describe("deriveEffectiveTier", () => {
  it("keeps the earned tier while the six months are still running", () => {
    const almostSixMonths = new Date("2024-07-14T12:00:00.000Z");

    expect(deriveEffectiveTier(3, JOINED, almostSixMonths)).toBe(3);
  });

  it("drops one step once six complete months have passed", () => {
    const sixMonths = new Date("2024-07-15T12:00:00.000Z");

    expect(deriveEffectiveTier(3, JOINED, sixMonths)).toBe(2);
  });

  it("drops one step per further complete six months", () => {
    expect(
      deriveEffectiveTier(3, JOINED, new Date("2025-01-15T12:00:00.000Z")),
    ).toBe(1);
    expect(
      deriveEffectiveTier(3, JOINED, new Date("2025-07-15T12:00:00.000Z")),
    ).toBe(0);
  });

  it("floors at zero however long the inactivity runs", () => {
    expect(
      deriveEffectiveTier(3, JOINED, new Date("2044-01-15T12:00:00.000Z")),
    ).toBe(0);
    expect(
      deriveEffectiveTier(0, JOINED, new Date("2044-01-15T12:00:00.000Z")),
    ).toBe(0);
  });

  it("never exceeds the earned tier, even with a future reference date", () => {
    const before = new Date("2023-01-15T12:00:00.000Z");

    expect(deriveEffectiveTier(1, JOINED, before)).toBe(1);
  });

  it("counts a month only when the calendar day is reached", () => {
    // 31 Jan + 6 months lands on 31 Jul; 30 Jul is not yet six complete months.
    const endOfMonth = new Date("2024-01-31T00:00:00.000Z");

    expect(
      deriveEffectiveTier(2, endOfMonth, new Date("2024-07-30T23:59:59.000Z")),
    ).toBe(2);
    expect(
      deriveEffectiveTier(2, endOfMonth, new Date("2024-07-31T00:00:00.000Z")),
    ).toBe(1);
  });

  it("does not decay when there is no reference date at all", () => {
    expect(
      deriveEffectiveTier(2, null, new Date("2044-01-15T12:00:00.000Z")),
    ).toBe(2);
  });
});
