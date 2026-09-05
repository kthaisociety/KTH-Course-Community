import { describe, expect, it } from "vitest";
import { deriveEarnedTier, deriveEffectiveTier } from "./tier";

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

/**
 * #161's ladder. Every case here is a sentence from that decision, so a change
 * to the rule has to change a sentence as well as a number.
 */
describe("deriveEarnedTier", () => {
  const reviewOf = (courseCode: string, userId = "u1") => ({
    courseCode,
    userId,
  });

  it("earns nothing from an account that has done nothing", () => {
    expect(
      deriveEarnedTier({
        userId: "u1",
        reviews: [],
        transcriptImportedCourses: [],
      }),
    ).toBe(0);
  });

  it("earns tier 1 for a published review", () => {
    expect(
      deriveEarnedTier({
        userId: "u1",
        reviews: [reviewOf("SF1625")],
        transcriptImportedCourses: [],
      }),
    ).toBe(1);
  });

  it("does not earn tier 1 from somebody else's review", () => {
    expect(
      deriveEarnedTier({
        userId: "u1",
        reviews: [reviewOf("SF1625", "u2")],
        transcriptImportedCourses: [],
      }),
    ).toBe(0);
  });

  it("earns tier 2 for an imported transcript with courses still unreviewed", () => {
    expect(
      deriveEarnedTier({
        userId: "u1",
        reviews: [reviewOf("SF1625")],
        transcriptImportedCourses: [
          { courseCode: "SF1625" },
          { courseCode: "DD1337" },
        ],
      }),
    ).toBe(2);
  });

  // The plain reading of "tier 2 is an imported transcript": somebody who hands
  // over their history before writing anything is at 2, not held at 0.
  it("earns tier 2 for an import even with no review at all", () => {
    expect(
      deriveEarnedTier({
        userId: "u1",
        reviews: [],
        transcriptImportedCourses: [{ courseCode: "SF1625" }],
      }),
    ).toBe(2);
  });

  it("earns tier 3 once every imported course has the app user's review", () => {
    expect(
      deriveEarnedTier({
        userId: "u1",
        reviews: [reviewOf("SF1625"), reviewOf("DD1337")],
        transcriptImportedCourses: [
          { courseCode: "SF1625" },
          { courseCode: "DD1337" },
        ],
      }),
    ).toBe(3);
  });

  // "All reviewed" over nothing is true and means nothing. An empty import must
  // not be a shortcut to the top of the ladder.
  it("cannot reach tier 3 with no imported courses", () => {
    expect(
      deriveEarnedTier({
        userId: "u1",
        reviews: [reviewOf("SF1625")],
        transcriptImportedCourses: [],
      }),
    ).toBe(1);
  });

  it("does not let another student's reviews complete a transcript", () => {
    expect(
      deriveEarnedTier({
        userId: "u1",
        reviews: [reviewOf("SF1625"), reviewOf("DD1337", "u2")],
        transcriptImportedCourses: [
          { courseCode: "SF1625" },
          { courseCode: "DD1337" },
        ],
      }),
    ).toBe(2);
  });

  // Manual entries never reach this function; the caller passes imported rows
  // only. Stated here so the contract is tested rather than assumed: a taken
  // course that is absent from the imported set cannot hold tier 3 back.
  it("judges tier 3 over the imported courses it was given and no others", () => {
    expect(
      deriveEarnedTier({
        userId: "u1",
        reviews: [reviewOf("SF1625")],
        transcriptImportedCourses: [{ courseCode: "SF1625" }],
      }),
    ).toBe(3);
  });

  // `selectUnreviewedCourses` answers "nothing is unreviewed" for an empty
  // viewer id, which would read as a completed transcript if the guard went.
  it("earns nothing without an app user to judge", () => {
    expect(
      deriveEarnedTier({
        userId: "",
        reviews: [],
        transcriptImportedCourses: [{ courseCode: "SF1625" }],
      }),
    ).toBe(0);
  });

  // The condition is not monotonic and is not meant to be; the column it feeds
  // is. This is the fall the writer must refuse to follow.
  it("falls back to tier 2 when a further import leaves courses unreviewed", () => {
    const reviews = [reviewOf("SF1625")];

    expect(
      deriveEarnedTier({
        userId: "u1",
        reviews,
        transcriptImportedCourses: [{ courseCode: "SF1625" }],
      }),
    ).toBe(3);
    expect(
      deriveEarnedTier({
        userId: "u1",
        reviews,
        transcriptImportedCourses: [
          { courseCode: "SF1625" },
          { courseCode: "DD1337" },
        ],
      }),
    ).toBe(2);
  });
});
