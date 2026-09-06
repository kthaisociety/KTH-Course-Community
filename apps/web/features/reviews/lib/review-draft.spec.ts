import { describe, expect, it } from "vitest";
import {
  decodeReviewDraft,
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

  /**
   * Nothing on the card can produce these. A draft restored from the tab's
   * storage can, and it is better to send the nearest real answer than to tell
   * the reviewer their finished review "is not finished".
   */
  it("clamps values that somehow left their scale rather than sending them", () => {
    const form = toReviewFormData(
      answered({
        workloadScore: 42,
        learningScore: 0,
        approachTheoryPercent: 400,
      }),
    );
    expect(form?.workloadScore).toBe(10);
    expect(form?.learningScore).toBe(1);
    expect(form?.approachTheoryPercent).toBe(95);
    expect(
      toReviewFormData(answered({ approachTheoryPercent: -20 }))
        ?.approachTheoryPercent,
    ).toBe(5);
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

/*
 * The one decoder both storages go through.
 *
 * `features/workspace/lib/workspace-storage.ts` and `./reviewer-session.ts`
 * used to hand-decode a stored draft each. They drifted by four lines, then by
 * what a malformed record *means* — one salvaged, the other rejected — which is
 * #166. Everything about the reading is asserted here, once; each storage's own
 * suite asserts that it goes through this and salvages.
 */
describe("decodeReviewDraft", () => {
  /**
   * The guard against a field being dropped on the way back in.
   *
   * Both old copies spread `EMPTY_REVIEW_DRAFT` before setting the fields they
   * knew about, which made the result structurally complete whether or not the
   * decoder had heard of every field: a field added to `ReviewDraft` compiled in
   * both, type-checked in both, and came back as its empty value after a reload.
   * The decoder no longer spreads it, so an omission is a compiler error — and
   * this is the same guarantee at runtime, for the day somebody puts the spread
   * back.
   *
   * `ANSWERED` is typed, so a field added to `ReviewDraft` has to be given a
   * value here too rather than quietly dropping out of the test with the code.
   */
  const ANSWERED: ReviewDraft = {
    methods: ["exam", "labs"],
    shares: [60, 40],
    approachTheoryPercent: 35,
    workloadScore: 8,
    learningScore: 6,
    happyTook: true,
    message: "Hard, and worth it",
  };

  it("carries every field of a fully answered draft across", () => {
    // Every field differs from the empty draft, so a dropped one shows up as a
    // difference rather than coincidentally matching the default.
    for (const [field, value] of Object.entries(ANSWERED)) {
      expect(value, field).not.toEqual(
        EMPTY_REVIEW_DRAFT[field as keyof ReviewDraft],
      );
    }

    expect(decodeReviewDraft(JSON.parse(JSON.stringify(ANSWERED)))).toEqual(
      ANSWERED,
    );
  });

  it("is nothing at all when the value is not an object", () => {
    for (const value of [null, undefined, "draft", 7, true, ["exam"]]) {
      expect(decodeReviewDraft(value), String(value)).toBeNull();
    }
  });

  it("reads an empty object as a draft nobody has answered", () => {
    expect(decodeReviewDraft({})).toEqual(EMPTY_REVIEW_DRAFT);
  });

  /*
   * Salvage, not reject — the decision #166 had to make, and the reason there
   * is only one decoder rather than one with a policy argument. Both screens
   * mirror their state straight back over storage, so a draft refused here is
   * a draft deleted within a commit. A bar we cannot draw is one unanswered
   * question; the write-up and the scores are still the writer's work.
   */
  describe("a stored draft that is wrong in one field", () => {
    const KEPT = {
      workloadScore: 8,
      learningScore: 3,
      happyTook: true,
      message: "Still mine",
    };

    it("keeps the answers when the bar's arrays do not line up", () => {
      expect(
        decodeReviewDraft({
          ...KEPT,
          methods: ["exam", "labs"],
          shares: [100],
        }),
      ).toEqual({ ...EMPTY_REVIEW_DRAFT, ...KEPT, methods: [], shares: [] });
    });

    it("drops a split naming a method this build does not have", () => {
      expect(
        decodeReviewDraft({
          ...KEPT,
          methods: ["exam", "quiz"],
          shares: [60, 40],
        })?.methods,
      ).toEqual([]);
    });

    it("drops a split that does not add up to 100", () => {
      expect(
        decodeReviewDraft({
          ...KEPT,
          methods: ["exam", "labs"],
          shares: [60, 30],
        })?.methods,
      ).toEqual([]);
    });

    it("drops a split naming the same method twice", () => {
      expect(
        decodeReviewDraft({
          ...KEPT,
          methods: ["exam", "exam"],
          shares: [50, 50],
        })?.methods,
      ).toEqual([]);
    });

    it("keeps a split that is entirely fine", () => {
      expect(
        decodeReviewDraft({ methods: ["exam", "labs"], shares: [60, 40] }),
      ).toMatchObject({ methods: ["exam", "labs"], shares: [60, 40] });
    });

    it("reads an answer of the wrong type as no answer", () => {
      expect(
        decodeReviewDraft({
          workloadScore: "8",
          learningScore: null,
          approachTheoryPercent: [],
          happyTook: "yes",
          message: 12,
        }),
      ).toEqual(EMPTY_REVIEW_DRAFT);
    });

    /*
     * `JSON.parse` cannot produce either, but this takes `unknown`. A
     * non-finite score would travel to `clampScore`, whose `Math.min`/`Math.max`
     * propagate it into a form the writer is then told is unfinished.
     */
    it("reads a score that is not a finite number as no answer", () => {
      expect(
        decodeReviewDraft({ workloadScore: Number.NaN })?.workloadScore,
      ).toBeNull();
      expect(
        decodeReviewDraft({ approachTheoryPercent: Number.POSITIVE_INFINITY })
          ?.approachTheoryPercent,
      ).toBeNull();
    });
  });
});
