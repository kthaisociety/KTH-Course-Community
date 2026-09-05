import type { ReviewFormData } from "@/features/reviews";
/*
 * The one place in this repo that reaches past a feature barrel, and the reason
 * is weight rather than taste.
 *
 * `@/features/reviews` is the reviews feature's cross-feature API and it is
 * what `review-draft-panel.tsx` imports, correctly — a component may pull in
 * components. But the barrel exports `Review`, the review dialog, which imports
 * `RichTextEditor`, which imports a Lexical theme and its stylesheet. Importing
 * it from here would drag all of that into a module that is arithmetic, and
 * into the `logic` vitest project, whose whole point is a node environment with
 * no DOM and no CSS pipeline. `lib/review-draft.ts` is the same pure module on
 * both sides of this import, so it is named directly.
 *
 * The type above still comes through the barrel: types are erased, so they cost
 * nothing at runtime and the convention is free to hold there.
 */
import {
  EMPTY_REVIEW_DRAFT as EMPTY_REVIEW_ANSWERS,
  isUntouched as noAnswersGiven,
  type ReviewDraft as ReviewAnswers,
  toReviewFormData as toAnsweredFormData,
} from "@/features/reviews/lib/review-draft";

/**
 * What the workspace pane's review draft has that the reviews feature's model
 * does not, and nothing else.
 *
 * The model itself — the picked methods, the parallel shares, the scores, the
 * write-up — and every piece of the examination bar's arithmetic live in
 * `features/reviews/lib/review-draft.ts`. This file used to carry a second copy
 * of all of it. It no longer does, because there is nothing about the pane that
 * makes a divider move differently: a review draft is one concept with two
 * presentations, and the model belongs to the feature that owns reviews rather
 * than to whichever screen was built first.
 *
 * ## What is genuinely the pane's
 *
 * Two flags. The pane draws an explicit "I don't remember" checkbox under the
 * examination bar and under the theory/applied track; the fast-track card, by
 * its artboard, draws neither and treats a question left alone as that same
 * answer. So the flags exist here and only here, and everything below is about
 * them: the progress bar counts a ticked box as a finished section, and
 * "Not saved yet" has to stop saying that once one is ticked.
 *
 * Both spell the same stored value — `null`, never zeroes — which is why they
 * cannot leak into what is written. `toReviewFormData` folds them away before
 * the reviews feature's own mapper ever sees the draft.
 */
export interface ReviewDraft extends ReviewAnswers {
  /** "I don't remember" for the examination split. Stores `null`, not zeroes. */
  examinationForgotten: boolean;
  /** "I don't remember" for the theory/applied question. */
  approachForgotten: boolean;
}

export const EMPTY_REVIEW_DRAFT: ReviewDraft = {
  ...EMPTY_REVIEW_ANSWERS,
  examinationForgotten: false,
  approachForgotten: false,
};

/** The three sections the progress bar counts. */
export const REVIEW_DRAFT_SECTIONS = 3;

/**
 * How many of the form's three sections the writer has finished, 0–3.
 *
 * The pane's own, because a ticked "I don't remember" finishes a section here
 * and there is no such box on the card. The write-up counts towards the third
 * section even though publishing does not require it: the bar reports how much
 * of the form has been filled in, not how much of it is compulsory.
 */
export function sectionsDone(draft: ReviewDraft): number {
  const format =
    (draft.methods.length > 0 || draft.examinationForgotten) &&
    (draft.approachTheoryPercent !== null || draft.approachForgotten);
  const profile = draft.workloadScore !== null && draft.learningScore !== null;
  const take = draft.happyTook !== null && draft.message.trim().length > 0;
  return [format, profile, take].filter(Boolean).length;
}

/**
 * Whether the writer has put anything into the draft at all.
 *
 * It is what the header's "Not saved yet" reads off. Ticking "I don't remember"
 * is putting something in — it is the answer to a question — so the shared
 * check is not enough on its own and the two flags are added to it here.
 */
export function isUntouched(draft: ReviewDraft): boolean {
  return (
    noAnswersGiven(draft) &&
    !draft.examinationForgotten &&
    !draft.approachForgotten
  );
}

/**
 * The pane's draft as the review form's data, or `null` when it is not
 * publishable yet.
 *
 * The flags are folded away first, and explicitly rather than by relying on the
 * checkboxes having cleared the answers they cover. A draft comes back out of
 * `localStorage`, where it may have been written by an older build or by a
 * tab that never finished a keystroke, and `toDraft` reads each field on its
 * own — so a stored draft carrying both a ticked box and the methods it was
 * meant to clear is a shape this has to survive. "I don't remember" wins,
 * because that is the answer the writer gave last.
 *
 * Past this point the pane is indistinguishable from every other way of writing
 * a review: `toReviewFormData` escapes the write-up into the markup
 * `reviews.message` holds, and `useAddReview` validates the result with
 * `reviewFormSchema` before anything is sent.
 */
export function toReviewFormData(draft: ReviewDraft): ReviewFormData | null {
  return toAnsweredFormData({
    ...draft,
    methods: draft.examinationForgotten ? [] : draft.methods,
    shares: draft.examinationForgotten ? [] : draft.shares,
    approachTheoryPercent: draft.approachForgotten
      ? null
      : draft.approachTheoryPercent,
  });
}
