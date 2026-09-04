import { describe, expect, it } from "vitest";
import { examinationDistributionSchema } from "@/types";
import {
  canPublish,
  dividerPositions,
  EMPTY_REVIEW_DRAFT,
  evenShares,
  moveDivider,
  nudgeDivider,
  type ReviewDraft,
  sectionsDone,
  toExaminationDistribution,
  toggleMethod,
  toReviewInput,
} from "./review-draft";

function draft(over: Partial<ReviewDraft> = {}): ReviewDraft {
  return { ...EMPTY_REVIEW_DRAFT, ...over };
}

describe("evenShares", () => {
  it.each([1, 2, 3, 4, 5, 6])("adds up to 100 for %i methods", (count) => {
    const shares = evenShares(count);
    expect(shares).toHaveLength(count);
    expect(shares.reduce((total, share) => total + share, 0)).toBe(100);
  });

  it("has nothing to split when nothing is picked", () => {
    expect(evenShares(0)).toEqual([]);
  });
});

describe("toggleMethod", () => {
  it("picks a method and splits the bar evenly", () => {
    const picked = toggleMethod(toggleMethod(draft(), "exam"), "labs");

    expect(picked.methods).toEqual(["exam", "labs"]);
    expect(picked.shares).toEqual([50, 50]);
  });

  it("unpicking re-splits what is left", () => {
    const three = ["exam", "labs", "projects"].reduce(
      (current, method) =>
        toggleMethod(current, method as "exam" | "labs" | "projects"),
      draft(),
    );
    const two = toggleMethod(three, "labs");

    expect(two.methods).toEqual(["exam", "projects"]);
    expect(two.shares).toEqual([50, 50]);
  });
});

describe("moveDivider", () => {
  const three = draft({
    methods: ["exam", "labs", "projects"],
    shares: [35, 35, 30],
  });

  it("moves only the pair either side of the divider", () => {
    const moved = moveDivider(three, 0, 20);

    expect(moved.shares).toEqual([20, 50, 30]);
    expect(moved.shares.reduce((total, share) => total + share, 0)).toBe(100);
  });

  it("snaps to five-point steps", () => {
    expect(moveDivider(three, 0, 22).shares[0]).toBe(20);
    expect(moveDivider(three, 0, 23).shares[0]).toBe(25);
  });

  it("never drags a segment out of existence", () => {
    expect(moveDivider(three, 0, 0).shares).toEqual([5, 65, 30]);
    expect(moveDivider(three, 0, 100).shares).toEqual([65, 5, 30]);
  });

  it("ignores a divider that is not there", () => {
    expect(moveDivider(three, 2, 50)).toBe(three);
  });

  it("nudges one step at a time from the keyboard", () => {
    expect(nudgeDivider(three, 0, -1).shares).toEqual([30, 40, 30]);
    expect(nudgeDivider(three, 1, 1).shares).toEqual([35, 40, 25]);
  });

  it("reports each divider as a running total", () => {
    expect(dividerPositions(three)).toEqual([35, 70]);
  });
});

describe("sectionsDone", () => {
  it("counts nothing on an untouched draft", () => {
    expect(sectionsDone(draft())).toBe(0);
  });

  it("counts format as done when both its questions are answered", () => {
    expect(
      sectionsDone(
        draft({
          methods: ["exam"],
          shares: [100],
          approachTheoryPercent: 60,
        }),
      ),
    ).toBe(1);
  });

  it("takes 'I don't remember' as an answer", () => {
    expect(
      sectionsDone(
        draft({ examinationForgotten: true, approachForgotten: true }),
      ),
    ).toBe(1);
  });

  it("counts all three when the write-up is there too", () => {
    expect(
      sectionsDone(
        draft({
          examinationForgotten: true,
          approachForgotten: true,
          workloadScore: 7,
          learningScore: 8,
          happyTook: true,
          message: "Worth it.",
        }),
      ),
    ).toBe(3);
  });
});

describe("canPublish", () => {
  it("needs happy took and both scores, and nothing else", () => {
    const ready = draft({
      happyTook: false,
      workloadScore: 3,
      learningScore: 9,
    });

    expect(canPublish(ready)).toBe(true);
    expect(canPublish({ ...ready, happyTook: null })).toBe(false);
    expect(canPublish({ ...ready, workloadScore: null })).toBe(false);
    expect(canPublish({ ...ready, learningScore: null })).toBe(false);
  });
});

describe("toExaminationDistribution", () => {
  it("fills every key and passes the wire contract", () => {
    const distribution = toExaminationDistribution(
      draft({ methods: ["labs", "exam"], shares: [60, 40] }),
    );

    expect(distribution).toEqual({
      exam: 40,
      assignments: 0,
      labs: 60,
      projects: 0,
      seminars: 0,
      other: 0,
    });
    expect(examinationDistributionSchema.safeParse(distribution).success).toBe(
      true,
    );
  });

  it("is absent, not zeroes, when the writer does not remember", () => {
    expect(
      toExaminationDistribution(
        draft({ methods: ["exam"], shares: [100], examinationForgotten: true }),
      ),
    ).toBeNull();
  });

  it("is absent when the question was never touched", () => {
    expect(toExaminationDistribution(draft())).toBeNull();
  });
});

describe("toReviewInput", () => {
  it("refuses a draft that is not publishable", () => {
    expect(toReviewInput(draft({ happyTook: true }))).toBeNull();
  });

  it("keeps the scores on the stored 1-10 scale", () => {
    const input = toReviewInput(
      draft({ happyTook: true, workloadScore: 8, learningScore: 6 }),
    );

    expect(input).toMatchObject({ workloadScore: 8, learningScore: 6 });
  });

  it("stores an unanswered approach as absent rather than the midpoint", () => {
    const input = toReviewInput(
      draft({ happyTook: true, workloadScore: 5, learningScore: 5 }),
    );

    expect(input?.approachTheoryPercent).toBeNull();
  });

  it("stores a remembered approach as the writer left it", () => {
    const input = toReviewInput(
      draft({
        happyTook: true,
        workloadScore: 5,
        learningScore: 5,
        approachTheoryPercent: 70,
      }),
    );

    expect(input?.approachTheoryPercent).toBe(70);
  });
});
