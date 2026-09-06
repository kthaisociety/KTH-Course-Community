import { describe, expect, it } from "vitest";
import { creditWeightedAverage, totalEarnedCredits } from "./grade-average";

describe("creditWeightedAverage", () => {
  it("weights each grade by the credits it was earned over", () => {
    const { average, gradedCredits } = creditWeightedAverage([
      { grade: "A", earnedCredits: 6 },
      { grade: "C", earnedCredits: 9 },
    ]);

    expect(gradedCredits).toBe(15);
    expect(average).toBeCloseTo((5 * 6 + 3 * 9) / 15, 10);
  });

  it("leaves out grades that are not on the A-E scale", () => {
    const { average, gradedCredits } = creditWeightedAverage([
      { grade: "A", earnedCredits: 6 },
      { grade: "P", earnedCredits: 7.5 },
      { grade: "F", earnedCredits: 6 },
    ]);

    expect(gradedCredits).toBe(6);
    expect(average).toBe(5);
  });

  it("reads a lowercase or padded grade as the same letter", () => {
    expect(
      creditWeightedAverage([{ grade: " b ", earnedCredits: 6 }]).average,
    ).toBe(4);
  });

  it("has no average when nothing graded carries credits", () => {
    expect(
      creditWeightedAverage([
        { grade: "A", earnedCredits: null },
        { grade: null, earnedCredits: 7.5 },
      ]),
    ).toMatchObject({ average: null, gradedCredits: 0 });
  });

  it("has no average over an empty list", () => {
    expect(creditWeightedAverage([])).toEqual({
      average: null,
      gradedCredits: 0,
      hasStoredGrades: false,
    });
  });

  it("reports stored grades even when none of them score", () => {
    expect(
      creditWeightedAverage([{ grade: "P", earnedCredits: 7.5 }]),
    ).toMatchObject({ average: null, hasStoredGrades: true });
  });

  it("does not count a blank grade as one that is stored", () => {
    expect(
      creditWeightedAverage([{ grade: "   ", earnedCredits: 7.5 }]),
    ).toMatchObject({ hasStoredGrades: false });
  });
});

describe("totalEarnedCredits", () => {
  it("sums the credits recorded, treating a missing figure as none", () => {
    expect(
      totalEarnedCredits([
        { grade: "A", earnedCredits: 7.5 },
        { grade: null, earnedCredits: 6 },
        { grade: "B", earnedCredits: null },
      ]),
    ).toBe(13.5);
  });
});
