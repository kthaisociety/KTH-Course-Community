import type { ExaminationDistribution, ReviewInput } from "@/types";
import {
  EXAMINATION_DISTRIBUTION_KEYS,
  MAX_REVIEW_SCORE,
  MIN_REVIEW_SCORE,
} from "@/types";

/**
 * A **review draft**: an unpublished review being written in the workspace
 * pane.
 *
 * It has no row anywhere. The pane holds it for as long as it is open, keyed
 * by course code so switching tabs does not lose it, and it becomes a Review
 * only when the writer publishes. Nothing in `server/` stores a draft, so the
 * design's "Save draft" has nothing behind it — see the PR for that.
 *
 * The shape is the form's, not the wire's: the examination split is a picked
 * order plus parallel shares, which is what a draggable bar needs, and
 * `toReviewInput` is the one place it becomes the contract in `@/types`.
 */

export type ExaminationKey = (typeof EXAMINATION_DISTRIBUTION_KEYS)[number];

export interface ReviewDraft {
  /** Examination methods the writer picked, in the order they picked them. */
  methods: ExaminationKey[];
  /** Whole percentages, parallel to `methods`, always adding up to 100. */
  shares: number[];
  /** "I don't remember" for the examination split. Stores `null`, not zeroes. */
  examinationForgotten: boolean;
  /** How theoretical the course was, 0–100. `null` until the writer answers. */
  approachTheoryPercent: number | null;
  /** "I don't remember" for the theory/applied question. */
  approachForgotten: boolean;
  workloadScore: number | null;
  learningScore: number | null;
  happyTook: boolean | null;
  message: string;
}

export const EMPTY_REVIEW_DRAFT: ReviewDraft = {
  methods: [],
  shares: [],
  examinationForgotten: false,
  approachTheoryPercent: null,
  approachForgotten: false,
  workloadScore: null,
  learningScore: null,
  happyTook: null,
  message: "",
};

/** The smallest share a segment may be dragged to, in whole percent. */
export const MIN_SHARE = 5;
/** Shares move in these steps, so the split stays a round number. */
export const SHARE_STEP = 5;

/** The middle of the theory/applied track, where an untouched drag starts. */
export const APPROACH_MIDPOINT = 50;

/**
 * An even split in 5% steps, with the remainder on the last segment.
 *
 * Six methods do not divide 100 evenly, so something has to absorb the
 * leftover; the design puts it on the last one and this keeps that, because
 * the alternative is shares that do not add up to 100 and a distribution the
 * server rejects.
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
 * `cumulativePercent` measured from the left edge of the bar.
 *
 * Only that pair moves: everything left of the divider keeps its width, so
 * dragging one boundary never silently reflows the rest. Both sides are held
 * at `MIN_SHARE` so a segment can never be dragged out of existence.
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
  for (let i = 0; i < draft.shares.length - 1; i++) {
    running += draft.shares[i];
    cuts.push(running);
  }
  return cuts;
}

/** How many of the form's three sections the writer has finished, 0–3. */
export function sectionsDone(draft: ReviewDraft): number {
  const format =
    (draft.methods.length > 0 || draft.examinationForgotten) &&
    (draft.approachTheoryPercent !== null || draft.approachForgotten);
  const profile = draft.workloadScore !== null && draft.learningScore !== null;
  const take = draft.happyTook !== null && draft.message.trim().length > 0;
  return [format, profile, take].filter(Boolean).length;
}

/** The three sections the progress bar counts. */
export const REVIEW_DRAFT_SECTIONS = 3;

/**
 * Whether the draft can be published.
 *
 * The write-up is the only optional part: `reviewInputSchema` requires the two
 * scores and `happyTook`, and everything else is nullable because "I don't
 * remember" is a real answer.
 */
export function canPublish(draft: ReviewDraft): boolean {
  return (
    draft.happyTook !== null &&
    draft.workloadScore !== null &&
    draft.learningScore !== null
  );
}

/** Clamp a score onto the stored 1–10 scale. */
export function clampScore(value: number): number {
  return Math.max(
    MIN_REVIEW_SCORE,
    Math.min(MAX_REVIEW_SCORE, Math.round(value)),
  );
}

/**
 * The picked shares as the stored distribution: every key present, unpicked
 * methods at 0, the whole thing adding up to 100.
 *
 * `null` when the writer said they do not remember, and equally when they
 * picked nothing — an untouched question is not an answer of zeroes.
 */
export function toExaminationDistribution(
  draft: ReviewDraft,
): ExaminationDistribution | null {
  if (draft.examinationForgotten || draft.methods.length === 0) return null;

  const distribution = Object.fromEntries(
    EXAMINATION_DISTRIBUTION_KEYS.map((key) => [key, 0]),
  ) as ExaminationDistribution;
  draft.methods.forEach((method, index) => {
    distribution[method] = draft.shares[index] ?? 0;
  });
  return distribution;
}

/**
 * The draft as the wire contract, or `null` when it is not publishable yet.
 *
 * An unanswered theory/applied question stores `null` rather than the
 * midpoint the track happens to be drawn at: 50 would claim the writer called
 * the course exactly balanced, and `CONTEXT.md` holds that an unanswered
 * recollection is stored absent, never invented.
 */
export function toReviewInput(draft: ReviewDraft): ReviewInput | null {
  if (
    draft.happyTook === null ||
    draft.workloadScore === null ||
    draft.learningScore === null
  ) {
    return null;
  }

  return {
    examinationDistribution: toExaminationDistribution(draft),
    approachTheoryPercent: draft.approachForgotten
      ? null
      : draft.approachTheoryPercent,
    workloadScore: clampScore(draft.workloadScore),
    learningScore: clampScore(draft.learningScore),
    happyTook: draft.happyTook,
    message: draft.message,
  };
}
