import type { ExaminationDistribution } from "@/types";
import {
  EXAMINATION_DISTRIBUTION_KEYS,
  MAX_REVIEW_SCORE,
  MIN_REVIEW_SCORE,
} from "@/types";
import type { ReviewFormData } from "../components/review";
import { fromPlainText } from "./review-text";

/**
 * A **review draft** as the fast-track card asks for it: an unpublished review,
 * held only for as long as the card is on screen.
 *
 * The shape is the card's, not the wire's. A draggable examination bar needs a
 * picked order plus parallel shares — an object keyed by method cannot say
 * which segment sits where — and `toReviewFormData` is the one place that
 * becomes something writable.
 *
 * ## Where the "I don't remember" answer went
 *
 * The workspace pane draws an explicit "I don't remember" checkbox under each
 * recollection. The fast-track card, by the artboard, draws none: a question
 * left alone *is* the "I don't remember" answer, and stores `null`. That is why
 * this draft has no `examinationForgotten` / `approachForgotten` flags where
 * `features/workspace/lib/review-draft.ts` does — an untouched track and a
 * ticked box are the same stored value, so a second flag would only be a second
 * way to spell it. Neither ever produces zeroes: `CONTEXT.md` is explicit that a
 * recollection nobody has is absent, not empty.
 *
 * ## The relationship to the workspace's copy
 *
 * `features/workspace/lib/review-draft.ts` carries a near-identical model, and
 * the bar geometry here — `evenShares`, `toggleMethod`, `moveDivider`,
 * `nudgeDivider`, `dividerPositions` — is the same arithmetic under the same
 * names. Both should collapse into this one, which is the reviews feature's to
 * own: the pane is one presentation of a review draft and the card stack is
 * another, and neither is where the model belongs. Concretely, the follow-up
 * deletes the workspace copy and has `review-draft-panel.tsx` import from
 * `@/features/reviews`, keeping only `examinationForgotten` /
 * `approachForgotten` — the two flags that are genuinely the pane's, because it
 * draws explicit "I don't remember" checkboxes where this card does not.
 *
 * It is not done here because `features/workspace/**` belongs to a change in
 * flight beside this one, and a rename across a moving feature is how a rebase
 * eats a day. **What the duplication cannot do is make the two disagree about a
 * stored review**: neither shape reaches the database. Both are mapped to
 * `ReviewFormData` and handed to `useAddReview`, which runs `reviewFormSchema`
 * itself before it sends anything — one write path, one validator, two forms.
 */

export type ExaminationKey = (typeof EXAMINATION_DISTRIBUTION_KEYS)[number];

export interface ReviewDraft {
  /** Examination methods the reviewer picked, in the order they picked them. */
  methods: ExaminationKey[];
  /** Whole percentages, parallel to `methods`, always adding up to 100. */
  shares: number[];
  /**
   * How theoretical the course was. The column takes 0–100; the card's track
   * runs `APPROACH_MIN`–`APPROACH_MAX`. `null` until the reviewer answers.
   */
  approachTheoryPercent: number | null;
  /** 1–10, as stored. `null` until answered — never 0, which is not on the scale. */
  workloadScore: number | null;
  /** 1–10, as stored. `null` until answered. */
  learningScore: number | null;
  happyTook: boolean | null;
  /** The optional one-liner. `""` becomes `null` on the way to the database. */
  message: string;
}

export const EMPTY_REVIEW_DRAFT: ReviewDraft = {
  methods: [],
  shares: [],
  approachTheoryPercent: null,
  workloadScore: null,
  learningScore: null,
  happyTook: null,
  message: "",
};

/** The smallest share a segment may be dragged to, in whole percent. */
export const MIN_SHARE = 5;
/** Shares move in these steps, so the split stays a round number. */
const SHARE_STEP = 5;

/** The middle of the theory/applied track, where an unanswered one is drawn. */
export const APPROACH_MIDPOINT = 50;

/**
 * The ends of the theory/applied track, as the artboard's own `startPct`
 * clamps them.
 *
 * `reviews.approach_theory_percent` accepts the whole 0–100 range, so this is
 * narrower than the column, not in conflict with it. The reason is the bar:
 * at 0 or 100 one of the two halves has no width, and a track with "Applied"
 * missing entirely reads as a broken control rather than as an extreme answer.
 * 95/5 is as absolute as a two-label bar can say something and still be a bar.
 */
export const APPROACH_MIN = 5;
export const APPROACH_MAX = 100 - APPROACH_MIN;

/**
 * An even split in 5% steps, with the remainder on the last segment.
 *
 * Six methods do not divide 100 evenly, so something has to absorb the
 * leftover; the artboard's `evenSplit` puts it on the last one and this keeps
 * that, because the alternative is shares that do not add up to 100 and a
 * distribution `examinationDistributionSchema` refuses.
 */
export function evenShares(count: number): number[] {
  if (count <= 0) return [];
  const base = Math.max(
    MIN_SHARE,
    Math.round(100 / count / SHARE_STEP) * SHARE_STEP,
  );
  const shares = new Array<number>(count).fill(base);
  shares[count - 1] = 100 - base * (count - 1);
  return shares;
}

/** Pick or unpick an examination method, re-splitting the bar evenly. */
export function toggleMethod(
  draft: ReviewDraft,
  method: ExaminationKey,
): ReviewDraft {
  const at = draft.methods.indexOf(method);
  const methods =
    at >= 0 ? draft.methods.toSpliced(at, 1) : [...draft.methods, method];
  return { ...draft, methods, shares: evenShares(methods.length) };
}

/**
 * Move the divider between segment `index` and the one after it to
 * `cumulativePercent`, measured from the left edge of the bar.
 *
 * Only that pair moves: everything left of the divider keeps its width, so
 * dragging one boundary never silently reflows the rest. Both sides are held at
 * `MIN_SHARE` so a segment can never be dragged out of existence — a 0% segment
 * would be a method the reviewer picked and then said nothing about.
 */
export function moveDivider(
  draft: ReviewDraft,
  index: number,
  cumulativePercent: number,
): ReviewDraft {
  if (index < 0 || index >= draft.shares.length - 1) return draft;

  const before = draft.shares
    .slice(0, index)
    .reduce((total, share) => total + share, 0);
  const pair = draft.shares[index] + draft.shares[index + 1];
  const stepped =
    Math.round((cumulativePercent - before) / SHARE_STEP) * SHARE_STEP;
  const left = Math.max(MIN_SHARE, Math.min(pair - MIN_SHARE, stepped));

  const shares = [...draft.shares];
  shares[index] = left;
  shares[index + 1] = pair - left;
  return { ...draft, shares };
}

/** Nudge a divider one step, which is how the keyboard drives the bar. */
export function nudgeDivider(
  draft: ReviewDraft,
  index: number,
  steps: number,
): ReviewDraft {
  if (index < 0 || index >= draft.shares.length - 1) return draft;
  const before = draft.shares
    .slice(0, index)
    .reduce((total, share) => total + share, 0);
  return moveDivider(
    draft,
    index,
    before + draft.shares[index] + steps * SHARE_STEP,
  );
}

/** Where each divider sits, as a running total from the left edge. */
export function dividerPositions(draft: ReviewDraft): number[] {
  const cuts: number[] = [];
  let running = 0;
  for (let index = 0; index < draft.shares.length - 1; index++) {
    running += draft.shares[index];
    cuts.push(running);
  }
  return cuts;
}

/**
 * Whether the card has enough to save.
 *
 * The three required answers, and only those: `reviewInputSchema` wants
 * `happyTook` and both scores, and everything else is nullable because "I don't
 * remember" is a real answer and the write-up is optional. It is the same rule
 * the workspace pane's publish button applies, phrased against this shape.
 */
export function isAnswered(draft: ReviewDraft): boolean {
  return (
    draft.happyTook !== null &&
    draft.workloadScore !== null &&
    draft.learningScore !== null
  );
}

/** Whether the reviewer has put anything into the card at all. */
export function isUntouched(draft: ReviewDraft): boolean {
  return (
    draft.happyTook === null &&
    draft.workloadScore === null &&
    draft.learningScore === null &&
    draft.approachTheoryPercent === null &&
    draft.methods.length === 0 &&
    draft.message.trim().length === 0
  );
}

/** Clamp a score onto the stored 1–10 scale. */
function clampScore(value: number): number {
  return Math.max(
    MIN_REVIEW_SCORE,
    Math.min(MAX_REVIEW_SCORE, Math.round(value)),
  );
}

/**
 * Clamp the theory answer onto the track it was dragged along.
 *
 * The control cannot produce anything else, so this is about the values that do
 * not come from the control: a draft restored from `sessionStorage`, which is
 * whatever was in the tab. Sending an out-of-range percent would fail
 * `reviewFormSchema` and tell the reviewer their review "is not finished",
 * which is a confusing thing to say about an answer they did give.
 */
function clampApproach(value: number): number {
  return Math.max(APPROACH_MIN, Math.min(APPROACH_MAX, Math.round(value)));
}

/**
 * The picked shares as the stored distribution: every key present, unpicked
 * methods at 0, the whole thing adding up to 100.
 *
 * `null` when the reviewer picked nothing, which on this card is the "I don't
 * remember" answer. An untouched question is not an answer of zeroes, and
 * `reviews.examination_distribution` is nullable precisely so that it does not
 * have to be written as one.
 */
export function toExaminationDistribution(
  draft: ReviewDraft,
): ExaminationDistribution | null {
  if (draft.methods.length === 0) return null;

  const distribution = Object.fromEntries(
    EXAMINATION_DISTRIBUTION_KEYS.map((key) => [key, 0]),
  ) as ExaminationDistribution;
  draft.methods.forEach((method, index) => {
    distribution[method] = draft.shares[index] ?? 0;
  });
  return distribution;
}

/**
 * The card as the review form's data, or `null` when it is not answered yet.
 *
 * This is the whole of the card's field mapping: past it the fast track is
 * indistinguishable from every other way of writing a review, because
 * `useAddReview` takes it from here and validates it with `reviewFormSchema`
 * before anything is sent.
 *
 * An unanswered theory/applied question stores `null` rather than the midpoint
 * the track happens to be drawn at: 50 would claim the reviewer called the
 * course exactly balanced, which is a recollection they never offered.
 *
 * The write-up is escaped into markup on the way out, because that is what
 * `reviews.message` holds and what the review card renders — see
 * `fromPlainText`. It is a format change, not a content one: an empty box is
 * still `""` here and still becomes `null` in `toStoredMessage`.
 */
export function toReviewFormData(draft: ReviewDraft): ReviewFormData | null {
  if (
    draft.happyTook === null ||
    draft.workloadScore === null ||
    draft.learningScore === null
  ) {
    return null;
  }

  return {
    examinationDistribution: toExaminationDistribution(draft),
    approachTheoryPercent:
      draft.approachTheoryPercent === null
        ? null
        : clampApproach(draft.approachTheoryPercent),
    workloadScore: clampScore(draft.workloadScore),
    learningScore: clampScore(draft.learningScore),
    happyTook: draft.happyTook,
    message: fromPlainText(draft.message),
  };
}
