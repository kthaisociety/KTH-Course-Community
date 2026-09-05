import { describe, expect, it } from "vitest";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { examinationDistributionSchema } from "@/types";
import {
  EMPTY_REVIEW_DRAFT,
  isUntouched,
  type ReviewDraft,
  sectionsDone,
  toReviewFormData,
} from "./review-draft";

/**
 * Only what the pane adds to the reviews feature's draft.
 *
 * The model itself and every bar transform now live in
 * `features/reviews/lib/review-draft.ts`, and `features/reviews/lib/
 * review-draft.spec.ts` is where they are tested. Re-testing `evenShares` or
 * `moveDivider` here would be testing the same function twice under two names,
 * which is what the duplication this file used to sit on top of felt like from
 * the inside.
 */
function draft(over: Partial<ReviewDraft> = {}): ReviewDraft {
  return { ...EMPTY_REVIEW_DRAFT, ...over };
}

/** A publishable draft, so a test can vary one thing at a time. */
function answered(over: Partial<ReviewDraft> = {}): ReviewDraft {
  return draft({
    happyTook: true,
    workloadScore: 7,
    learningScore: 8,
    ...over,
  });
}

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
        answered({
          examinationForgotten: true,
          approachForgotten: true,
          message: "Worth it.",
        }),
      ),
    ).toBe(3);
  });
});

describe("isUntouched", () => {
  it("is true for a draft nobody has answered anything on", () => {
    expect(isUntouched(draft())).toBe(true);
  });

  // The header reads "Not saved yet" off this, and ticking a box is an answer
  // the pane has to keep — the shared check cannot see either flag.
  it("is false once a checkbox says the writer does not remember", () => {
    expect(isUntouched(draft({ examinationForgotten: true }))).toBe(false);
    expect(isUntouched(draft({ approachForgotten: true }))).toBe(false);
  });

  it("is false once anything else is answered", () => {
    expect(isUntouched(draft({ workloadScore: 3 }))).toBe(false);
    expect(isUntouched(draft({ message: "Good." }))).toBe(false);
  });
});

describe("what the pane sends", () => {
  it("has nothing to send until happy, workload and learning are answered", () => {
    expect(toReviewFormData(draft())).toBeNull();
    expect(toReviewFormData(draft({ happyTook: true }))).toBeNull();
    expect(
      toReviewFormData(draft({ happyTook: true, workloadScore: 5 })),
    ).toBeNull();
  });

  it("keeps the scores on the stored 1-10 scale", () => {
    const form = toReviewFormData(answered());

    expect(form?.workloadScore).toBe(7);
    expect(form?.learningScore).toBe(8);
  });

  it("fills every examination key and passes the wire contract", () => {
    const form = toReviewFormData(
      answered({ methods: ["exam", "labs"], shares: [60, 40] }),
    );

    expect(
      examinationDistributionSchema.safeParse(form?.examinationDistribution)
        .success,
    ).toBe(true);
    expect(form?.examinationDistribution).toMatchObject({
      exam: 60,
      labs: 40,
      assignments: 0,
      projects: 0,
      seminars: 0,
      other: 0,
    });
  });

  it("stores an unanswered approach as absent rather than the midpoint", () => {
    expect(toReviewFormData(answered())?.approachTheoryPercent).toBeNull();
  });

  // "I don't remember" is a stored `null`, never zeroes, and it has to win over
  // whatever the cleared control happened to leave behind — a draft restored
  // from `sessionStorage` is read field by field, so both can be present at once.
  it("drops answers the writer said they do not remember", () => {
    const form = toReviewFormData(
      answered({
        examinationForgotten: true,
        methods: ["exam"],
        shares: [100],
        approachForgotten: true,
        approachTheoryPercent: 80,
      }),
    );

    expect(form?.examinationDistribution).toBeNull();
    expect(form?.approachTheoryPercent).toBeNull();
  });

  /*
   * The data-loss regression.
   *
   * `reviews.message` is only ever rendered through `parse(sanitizeHtml(...))`,
   * and `sanitizeHtml` runs with `stripIgnoreTag` — so a raw plain-text
   * write-up loses everything tag-shaped on its way to the screen, silently and
   * after it was stored. The pane's box is a plain `<textarea>`, so escaping on
   * the way out is the only thing standing between a reviewer and a sentence
   * with a hole in it.
   */
  it("keeps characters a renderer would otherwise eat as markup", () => {
    const form = toReviewFormData(
      answered({ message: "use <vector> from STL & <algorithm> too" }),
    );

    expect(form?.message).toBe(
      "<p>use &lt;vector&gt; from STL &amp; &lt;algorithm&gt; too</p>",
    );
    // And what the review card actually renders: `sanitizeHtml` with
    // `stripIgnoreTag` is the step that used to delete the useful half of the
    // sentence, so it is run here rather than described.
    expect(sanitizeHtml(form?.message ?? "")).toContain("&lt;vector&gt;");
    expect(sanitizeHtml(form?.message ?? "")).not.toBe(
      "<p>use  from STL & </p>",
    );
  });

  it("leaves a write-up nobody typed empty rather than inventing a paragraph", () => {
    expect(toReviewFormData(answered({ message: "   " }))?.message).toBe("");
  });
});
