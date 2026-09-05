import { describe, expect, it } from "vitest";
import {
  dividerPositions,
  EMPTY_REVIEW_DRAFT,
  evenShares,
  isAnswered,
  isUntouched,
  MIN_SHARE,
  moveDivider,
  nudgeDivider,
  type ReviewDraft,
  toExaminationDistribution,
  toggleMethod,
  toReviewFormData,
} from "./review-draft";

function draft(over: Partial<ReviewDraft> = {}): ReviewDraft {
  return { ...EMPTY_REVIEW_DRAFT, ...over };
}

/** A card with the three answers a review cannot be written without. */
function answered(over: Partial<ReviewDraft> = {}): ReviewDraft {
  return draft({
    happyTook: true,
    workloadScore: 7,
    learningScore: 4,
    ...over,
  });
}

describe("the examination bar", () => {
  it("splits evenly in 5% steps and always adds up to 100", () => {
    for (let count = 1; count <= 6; count++) {
      const shares = evenShares(count);
      expect(shares).toHaveLength(count);
      expect(shares.reduce((total, share) => total + share, 0)).toBe(100);
      expect(shares.every((share) => share % 5 === 0)).toBe(true);
      expect(shares.every((share) => share >= MIN_SHARE)).toBe(true);
    }
  });

  it("keeps the order the reviewer picked in", () => {
    const picked = toggleMethod(toggleMethod(draft(), "labs"), "exam");
    expect(picked.methods).toEqual(["labs", "exam"]);
    expect(picked.shares).toEqual([50, 50]);

    const unpicked = toggleMethod(picked, "labs");
    expect(unpicked.methods).toEqual(["exam"]);
    expect(unpicked.shares).toEqual([100]);
  });

  it("moves one divider and leaves every other segment where it was", () => {
    const three = draft({
      methods: ["exam", "labs", "projects"],
      shares: [35, 35, 30],
    });

    const moved = moveDivider(three, 1, 88);
    expect(moved.shares).toEqual([35, 55, 10]);
    expect(moved.shares.reduce((total, share) => total + share, 0)).toBe(100);
  });

  // A 0% segment would be a method the reviewer picked and then said nothing
  // about, which is not an answer the bar can express.
  it("never drags a segment out of existence", () => {
    const two = draft({ methods: ["exam", "labs"], shares: [50, 50] });

    expect(moveDivider(two, 0, 200).shares).toEqual([95, 5]);
    expect(moveDivider(two, 0, -200).shares).toEqual([5, 95]);
  });

  it("ignores a divider that is not between two segments", () => {
    const two = draft({ methods: ["exam", "labs"], shares: [50, 50] });

    expect(moveDivider(two, 1, 50)).toBe(two);
    expect(moveDivider(two, -1, 50)).toBe(two);
    expect(nudgeDivider(two, 1, 1)).toBe(two);
  });

  it("nudges by one step, which is how the keyboard drives it", () => {
    const two = draft({ methods: ["exam", "labs"], shares: [50, 50] });

    expect(nudgeDivider(two, 0, 1).shares).toEqual([55, 45]);
    expect(nudgeDivider(two, 0, -1).shares).toEqual([45, 55]);
  });

  it("puts a divider at each running total", () => {
    expect(
      dividerPositions(
        draft({ methods: ["exam", "labs", "other"], shares: [20, 30, 50] }),
      ),
    ).toEqual([20, 50]);
    expect(
      dividerPositions(draft({ methods: ["exam"], shares: [100] })),
    ).toEqual([]);
  });
});

describe("what reaches the database", () => {
  /**
   * The rule `CONTEXT.md` states outright: an examination split nobody
   * remembers is stored absent, never as six zeroes. On this card there is no
   * "I don't remember" checkbox — leaving the bar alone *is* that answer.
   */
  it("stores no distribution at all when the bar was left alone", () => {
    expect(toExaminationDistribution(draft())).toBeNull();
    expect(toReviewFormData(answered())?.examinationDistribution).toBeNull();
  });

  it("stores every key, with the unpicked ones at zero, once anything is picked", () => {
    const form = toReviewFormData(
      answered({ methods: ["labs", "exam"], shares: [40, 60] }),
    );

    expect(form?.examinationDistribution).toEqual({
      exam: 60,
      assignments: 0,
      labs: 40,
      projects: 0,
      seminars: 0,
      other: 0,
    });
  });

  /**
   * The track is drawn at the midpoint when unanswered, and 50 would claim the
   * reviewer called the course exactly balanced — a recollection they never
   * offered.
   */
  it("never mistakes the theory track's resting position for an answer", () => {
    expect(toReviewFormData(answered())?.approachTheoryPercent).toBeNull();
    expect(
      toReviewFormData(answered({ approachTheoryPercent: 50 }))
        ?.approachTheoryPercent,
    ).toBe(50);
  });

  it("carries the scores through raw, on the 1–10 scale the column stores", () => {
    const form = toReviewFormData(
      answered({ workloadScore: 9, learningScore: 1 }),
    );
    expect(form?.workloadScore).toBe(9);
    expect(form?.learningScore).toBe(1);
  });

  it("clamps a score that somehow left the scale rather than sending it", () => {
    const form = toReviewFormData(
      answered({ workloadScore: 42, learningScore: 0 }),
    );
    expect(form?.workloadScore).toBe(10);
    expect(form?.learningScore).toBe(1);
  });

  it("has nothing to send until happy, workload and learning are answered", () => {
    expect(toReviewFormData(draft())).toBeNull();
    expect(toReviewFormData(answered({ happyTook: null }))).toBeNull();
    expect(toReviewFormData(answered({ workloadScore: null }))).toBeNull();
    expect(toReviewFormData(answered({ learningScore: null }))).toBeNull();
    expect(isAnswered(answered())).toBe(true);
  });

  // `happyTook: false` is an answer. Anything reading it for truthiness would
  // hold a reviewer inside a card they had in fact finished.
  it("counts an unhappy answer as an answer", () => {
    expect(isAnswered(answered({ happyTook: false }))).toBe(true);
    expect(toReviewFormData(answered({ happyTook: false }))?.happyTook).toBe(
      false,
    );
  });

  /**
   * The write-up is the only optional part, and an empty one becomes `null` on
   * the way to the column — `toStoredMessage`, inside the write path, does
   * that. The mapping's job is to hand over what was typed, in the markup
   * `reviews.message` holds.
   */
  it("carries the write-up over as the markup the column stores", () => {
    expect(toReviewFormData(answered())?.message).toBe("");
    expect(
      toReviewFormData(answered({ message: "Bring time." }))?.message,
    ).toBe("<p>Bring time.</p>");
  });

  /**
   * The card's box is a plain textarea, and `sanitizeHtml` strips anything
   * tag-shaped on the way to the screen. Escaping first is what stops a
   * reviewer's sentence losing its useful half.
   */
  it("keeps characters that would otherwise be read as markup", () => {
    expect(
      toReviewFormData(answered({ message: "Use <vector> & <map>." }))?.message,
    ).toBe("<p>Use &lt;vector&gt; &amp; &lt;map&gt;.</p>");
  });
});

describe("isUntouched", () => {
  it("is true only for a card nobody has answered anything on", () => {
    expect(isUntouched(draft())).toBe(true);
    expect(isUntouched(draft({ message: "  " }))).toBe(true);
    expect(isUntouched(draft({ happyTook: false }))).toBe(false);
    expect(isUntouched(draft({ approachTheoryPercent: 50 }))).toBe(false);
  });
});
