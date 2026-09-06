import { describe, expect, it } from "vitest";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { examinationDistributionSchema } from "@/types";
import {
  decodeReviewDraft,
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

/*
 * Only what the pane adds to the shared decoder, for the same reason as the
 * rest of this file. The answers, and every salvage rule about them, are
 * `features/reviews/lib/review-draft.spec.ts`'s.
 */
describe("decodeReviewDraft", () => {
  /**
   * Typed, so a field added to either half of the shape has to be given a value
   * here and then survive the round trip. That is the runtime half of #166's
   * guarantee; the compile-time half is that neither decoder defaults anything
   * from an empty draft any more, so an unhandled field fails to build.
   */
  const ANSWERED: ReviewDraft = {
    methods: ["exam", "labs"],
    shares: [60, 40],
    approachTheoryPercent: 35,
    approachForgotten: true,
    examinationForgotten: true,
    workloadScore: 8,
    learningScore: 6,
    happyTook: true,
    message: "Hard, and worth it",
  };

  it("carries every field of a fully answered draft across", () => {
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
    for (const value of [null, "draft", 7, ["exam"]]) {
      expect(decodeReviewDraft(value), String(value)).toBeNull();
    }
  });

  /**
   * The flags are the pane's whole extension, and they are the one part of a
   * draft with no null: a box is ticked or it is not. Anything that is not
   * `true` is a box nobody ticked, which is also what an older build that never
   * wrote them looks like.
   */
  it("reads a flag that is not true as a box nobody ticked", () => {
    expect(decodeReviewDraft({})).toMatchObject({
      examinationForgotten: false,
      approachForgotten: false,
    });
    expect(
      decodeReviewDraft({ examinationForgotten: "yes", approachForgotten: 1 }),
    ).toMatchObject({ examinationForgotten: false, approachForgotten: false });
  });

  /*
   * A draft carrying both a ticked box and the methods it was meant to clear is
   * a shape storage can hold — the fields are read one at a time — and
   * `toReviewFormData` is where "I don't remember" wins. The decoder's job is
   * to report what was stored, not to tidy it.
   */
  it("keeps a ticked box and the answers beside it, and lets the mapper decide", () => {
    const draft = decodeReviewDraft({
      methods: ["exam"],
      shares: [100],
      examinationForgotten: true,
      workloadScore: 5,
      learningScore: 5,
      happyTook: true,
    });

    expect(draft).toMatchObject({
      methods: ["exam"],
      examinationForgotten: true,
    });
    expect(
      // biome-ignore lint/style/noNonNullAssertion: decoded from a record above.
      toReviewFormData(draft!)?.examinationDistribution,
    ).toBeNull();
  });
});
