import { describe, expect, it } from "vitest";
import { reviewFormSchema } from "./review-form-schema";

const scoresOnly = {
  happyTook: true,
  message: "<p><br></p>",
  examinationDistribution: null,
  approachTheoryPercent: null,
  workloadScore: 7,
  learningScore: 9,
};

describe("reviewFormSchema", () => {
  it("will not publish a first review with nothing written in it", () => {
    const result = reviewFormSchema({ requireMessage: true }).safeParse(
      scoresOnly,
    );
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Write a review.");
  });

  // A stored review may legitimately have no message: `reviews.message` is
  // nullable. Requiring prose to save an edit would trap its author, unable to
  // correct a score without inventing text to go with it.
  it("lets the author of a scores-only review save it unchanged", () => {
    expect(
      reviewFormSchema({ requireMessage: false }).safeParse(scoresOnly).success,
    ).toBe(true);
  });

  it("holds every other answer to the same rule either way", () => {
    for (const requireMessage of [true, false]) {
      const schema = reviewFormSchema({ requireMessage });
      expect(
        schema.safeParse({
          ...scoresOnly,
          message: "<p>Worth it.</p>",
          workloadScore: 11,
        }).success,
      ).toBe(false);
      expect(
        schema.safeParse({
          ...scoresOnly,
          message: "<p>Worth it.</p>",
          approachTheoryPercent: 101,
        }).success,
      ).toBe(false);
      expect(
        schema.safeParse({
          ...scoresOnly,
          message: "<p>Worth it.</p>",
          examinationDistribution: {
            exam: 50,
            assignments: 30,
            labs: 0,
            projects: 0,
            seminars: 0,
            other: 0,
          },
        }).success,
      ).toBe(false);
    }
  });
});
