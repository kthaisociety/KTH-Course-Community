import type { Review } from "@/types";
import { EXAMINATION_DISTRIBUTION_KEYS } from "@/types";
import {
  APPROACH_MAX,
  APPROACH_MIN,
  answersToReviewFormData,
  answersUntouched,
  decodeAnswers,
  EMPTY_REVIEW_ANSWERS,
  type ExaminationKey,
  isAnswersRecord,
  type ReviewAnswers,
} from "./review-answers";
import type { ReviewFormData } from "./review-form-schema";
import { toPlainText } from "./review-text";

/**
 * A **review draft**: a review being written or rewritten in the full editor,
 * which is the answers in `./review-answers.ts` plus the two "I don't remember"
 * checkboxes drawn beside them.
 *
 * The model itself — the picked methods, the parallel shares, the scores, the
 * write-up — and every piece of the examination bar's arithmetic live next
 * door. Nothing about a host makes a divider move differently: a review draft
 * is one concept with two presentations, and both live in this feature.
 *
 * ## What is genuinely the draft's
 *
 * Two flags. The editor draws an explicit "I don't remember" checkbox under the
 * examination bar and under the theory/applied track; the fast-track card, by
 * its artboard, draws neither and treats a question left alone as that same
 * answer. So the flags exist here and only here, and most of what follows is
 * about them: the progress bar counts a ticked box as a finished section, and
 * "Not saved yet" has to stop saying that once one is ticked.
 *
 * Both spell the same stored value — `null`, never zeroes — which is why they
 * cannot leak into what is written. `toReviewFormData` folds them away before
 * `answersToReviewFormData` ever sees the draft.
 *
 * ## Two hosts, one editor
 *
 * `ReviewDraftEditor` is the one component that edits this shape. The workspace
 * pane hosts it for a review being written, keeping the draft in
 * `localStorage`; My Page hosts it for a review already published, loading it
 * from the row with `toReviewDraft` and keeping nothing. Publishing and
 * rewriting are `useAddReview` and `useEditReview`, and neither takes anything
 * but a `ReviewFormData`.
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

/**
 * A stored draft as the editor holds it, or `null` when the stored value is not
 * an object and there is nothing in it to salvage.
 *
 * The answers are `./review-answers.ts`'s to decode, for the same reason the
 * model is: there is nothing about a host that makes a stored `workloadScore`
 * mean something else. Only the two flags are read here, which is exactly the
 * extension this file exists for.
 *
 * The record guard is shared rather than repeated so that the flags come off a
 * value TypeScript has *checked* is a record — the alternative is decoding the
 * answers first and then asserting that the input must have been a record after
 * all, which is an unchecked cast.
 *
 * Nothing is defaulted from `EMPTY_REVIEW_DRAFT`. Adding a field to this
 * interface fails to compile here, and adding one to `ReviewAnswers` fails to
 * compile in the answers decoder; between them there is no field on either half
 * of the shape that can be added without a compiler error naming the decoder
 * that has to learn about it.
 */
export function decodeReviewDraft(value: unknown): ReviewDraft | null {
  if (!isAnswersRecord(value)) return null;
  return {
    ...decodeAnswers(value),
    examinationForgotten: value.examinationForgotten === true,
    approachForgotten: value.approachForgotten === true,
  };
}

/** The three sections the progress bar counts. */
export const REVIEW_DRAFT_SECTIONS = 3;

/**
 * How many of the form's three sections the writer has finished, 0–3.
 *
 * The editor's own, because a ticked "I don't remember" finishes a section here
 * and there is no such box on the fast-track card. The write-up counts towards
 * the third section even though publishing does not require it: the bar reports
 * how much of the form has been filled in, not how much of it is compulsory.
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
 * It is what the pane header's "Not saved yet" reads off. Ticking "I don't
 * remember" is putting something in — it is the answer to a question — so the
 * shared check is not enough on its own and the two flags are added to it here.
 */
export function isUntouched(draft: ReviewDraft): boolean {
  return (
    answersUntouched(draft) &&
    !draft.examinationForgotten &&
    !draft.approachForgotten
  );
}

/**
 * The draft as the review form's data, or `null` when it is not finished yet.
 *
 * The flags are folded away first, and explicitly rather than by relying on the
 * checkboxes having cleared the answers they cover. A draft comes back out of
 * `localStorage`, where it may have been written by an older build or by a tab
 * that never finished a keystroke, and `decodeReviewDraft` reads each field on
 * its own — so a stored draft carrying both a ticked box and the methods it was
 * meant to clear is a shape this has to survive. "I don't remember" wins,
 * because that is the answer the writer gave last.
 *
 * Past this point the editor is indistinguishable from every other way of
 * writing a review: `answersToReviewFormData` escapes the write-up into the
 * markup `reviews.message` holds, and `useAddReview` / `useEditReview` validate
 * the result with `reviewFormSchema` before anything is sent.
 */
export function toReviewFormData(draft: ReviewDraft): ReviewFormData | null {
  return answersToReviewFormData({
    ...draft,
    methods: draft.examinationForgotten ? [] : draft.methods,
    shares: draft.examinationForgotten ? [] : draft.shares,
    approachTheoryPercent: draft.approachForgotten
      ? null
      : draft.approachTheoryPercent,
  });
}

/**
 * The stored examination split as the bar holds it: the methods the reviewer
 * picked, in the catalogue's order, and their shares beside them.
 *
 * The stored column names every method and gives the unpicked ones a `0`, so
 * the zeroes are dropped here — a segment of no width is a method the reviewer
 * picked and then said nothing about, which is not a thing the bar can draw or
 * a divider can be dragged off.
 *
 * Order is `EXAMINATION_DISTRIBUTION_KEYS`, and it is not the order the
 * reviewer picked in: that order is the draft's alone and was never written
 * down. Reopening a review therefore lays the same segments out left to right
 * however they were first picked, which is a cosmetic change to a bar whose
 * arithmetic is unaffected — every share keeps its own width.
 */
function toExaminationSplit(
  distribution: Review["examinationDistribution"],
): Pick<ReviewDraft, "methods" | "shares"> {
  if (distribution === null) return { methods: [], shares: [] };

  const methods: ExaminationKey[] = [];
  const shares: number[] = [];
  for (const key of EXAMINATION_DISTRIBUTION_KEYS) {
    const share = distribution[key];
    if (share > 0) {
      methods.push(key);
      shares.push(share);
    }
  }
  return { methods, shares };
}

/**
 * A published review, back in the editor that writes one.
 *
 * The inverse of `toReviewFormData`, and the whole of what "edit" means: past
 * this point rewriting a review is the same code as writing one. It is not a
 * perfect inverse and cannot be, because two of the fields are stored in a
 * narrower form than the draft holds:
 *
 * - **The write-up.** `reviews.message` is markup and the editor's textarea is
 *   plain text, so it comes back through `toPlainText`. A review whose message
 *   was written in the retired rich-text dialog therefore loses its bold and
 *   its lists on the way in — the text survives, the formatting does not, and
 *   saving stores the plain-text version escaped by `fromPlainText`. That is
 *   the same trade the fast-track card and the pane already make when they
 *   publish, and there is no editor left in the app that can produce the
 *   markup.
 *
 * - **The approach.** `reviews.approach_theory_percent` accepts the whole 0–100
 *   range; the track the editor drags along stops at `APPROACH_MIN` and
 *   `APPROACH_MAX`, because at either end one of the two labels has no width
 *   and the bar reads as broken rather than as an extreme answer. A stored 0 or
 *   100 — which only the retired dialog's slider could produce — is clamped
 *   *here*, on the way in, so the reviewer sees the value they are about to
 *   save. `answersToReviewFormData` clamps too; doing it only there would move
 *   the answer silently at the moment of saving.
 *
 * Both "I don't remember" boxes come back ticked from a `null` column, which is
 * the answer that column holds: the reviewer said they did not remember, and a
 * reopened editor has to show that as the given answer rather than as a
 * question nobody reached.
 */
export function toReviewDraft(review: Review): ReviewDraft {
  const { approachTheoryPercent } = review;
  return {
    ...toExaminationSplit(review.examinationDistribution),
    examinationForgotten: review.examinationDistribution === null,
    approachTheoryPercent:
      approachTheoryPercent === null
        ? null
        : Math.max(APPROACH_MIN, Math.min(APPROACH_MAX, approachTheoryPercent)),
    approachForgotten: approachTheoryPercent === null,
    workloadScore: review.workloadScore,
    learningScore: review.learningScore,
    happyTook: review.happyTook,
    message: toPlainText(review.message),
  };
}
