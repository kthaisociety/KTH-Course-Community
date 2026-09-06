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
 * ## The workspace pane writes through this model too
 *
 * `features/workspace/lib/review-draft.ts` holds only the two flags that are
 * genuinely the pane's, `examinationForgotten` and `approachForgotten`, and
 * extends this shape with them. The pane draws explicit "I don't remember"
 * checkboxes where this card leaves the question alone, which is the one real
 * difference between the two surfaces. Everything else — the shape, the bar
 * arithmetic — is here, once.
 *
 * That is why `toggleMethod`, `moveDivider` and `nudgeDivider` are generic over
 * the draft rather than typed to this exact shape. Each of them replaces
 * `methods` and `shares` and copies everything else through untouched, so a
 * caller with a wider draft gets its own type back instead of having its extra
 * fields erased at the type level while surviving at runtime.
 *
 * What the split cannot do is make the two disagree about a stored review.
 * Neither shape reaches the database: both are mapped to `ReviewFormData` and
 * handed to `useAddReview`, which runs `reviewFormSchema` itself before it
 * sends anything — one write path, one validator, two forms.
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

/* ── Reading a draft back out of a browser ────────────────────────────────────
 *
 * Two screens keep an unpublished draft in the browser and read it back on the
 * next page load: the workspace pane, in `localStorage`, and the fast-track
 * reviewer, in its tab's `sessionStorage`. This is the one decoder both go
 * through, so they cannot drift about what a malformed record means.
 *
 * ## Why it does not spread `EMPTY_REVIEW_DRAFT`
 *
 * `{ ...EMPTY_REVIEW_DRAFT, ... }` followed by the fields the decoder knows
 * about makes the result structurally complete whether or not it has heard of
 * every field — so a field added to `ReviewDraft` compiles, passes the type
 * checker, and comes back as its empty value on the next reload, silently, and
 * delayed until somebody reloads.
 *
 * The object literal below therefore names every field and defaults none of
 * them. Adding a field to `ReviewDraft` now fails to compile *here*, in the one
 * place that has to learn about it. Do not reintroduce the spread — and if
 * somebody does, `review-draft.spec.ts` round-trips an exhaustive fixture whose
 * every field differs from the empty draft, which catches the same mistake at
 * runtime. The fixture is typed `ReviewDraft`, so a new field forces a new value
 * into it rather than being quietly omitted from the test too.
 *
 * ## Salvage, not reject — and only one of them exists
 *
 * A field that cannot be read is dropped; the rest of the draft comes back. The
 * only thing that yields "no draft" is a value that is not an object at all,
 * because there is nothing in a string to salvage.
 *
 * That is not a preference. Both screens mirror their state straight back over
 * storage — the workspace pane on its write effect, the reviewer on
 * `useEffect(… , [round])` in `reviewer.tsx`, which fires on the mount that
 * follows the restore — so a draft this function refuses is a draft *deleted*,
 * within a commit, permanently. Rejecting a whole draft over one unreadable
 * field burns the write-up and the scores to avoid drawing a bar wrong.
 *
 * Rejection at the *round* level is a different granularity and it is real:
 * `reviewer-session.ts` still treats an absent or empty queue as no round.
 * Rejecting one draft never rejects the round — it deals the same card with the
 * reviewer's answers thrown away — so no call site wants it, and there is
 * deliberately no policy switch here to give one.
 */

/**
 * Whether a parsed value could be a draft at all.
 *
 * An array is not: `JSON.parse("[1,2]")` is an object with a `length`, and
 * reading fields off it would decode a list into an untouched draft rather than
 * into nothing.
 *
 * Exported because the workspace pane's draft is this shape plus two flags, and
 * its decoder has to read those two off the same record — see
 * `features/workspace/lib/review-draft.ts`. Sharing the guard is what lets it
 * extend `decodeDraftAnswers` without asserting a type it has not checked.
 */
export function isDraftRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * A stored number, or no answer.
 *
 * `Number.isFinite` rather than a bare `typeof`: nothing `JSON.parse` produces
 * is `NaN` or `Infinity`, but this takes `unknown` and a non-finite score would
 * travel all the way to `clampScore`, whose `Math.min`/`Math.max` propagate it
 * into a form the writer is then told is unfinished.
 */
function toScore(candidate: unknown): number | null {
  return typeof candidate === "number" && Number.isFinite(candidate)
    ? candidate
    : null;
}

/** The examination split as `ReviewDraft` holds it: two parallel arrays. */
type ExaminationSplit = Pick<ReviewDraft, "methods" | "shares">;

function isExaminationKey(value: unknown): value is ExaminationKey {
  return (EXAMINATION_DISTRIBUTION_KEYS as readonly unknown[]).includes(value);
}

/**
 * The stored examination split, or no split at all.
 *
 * `methods` and `shares` are parallel, always add up to 100, and name methods
 * *this* build knows about. All three are checked rather than asserted: a
 * stored `"quiz"` from a build that offered one would otherwise reach the bar
 * as a segment with no colour and no label, and a length mismatch would reach
 * `moveDivider` as arithmetic over `undefined`.
 *
 * Anything that fails drops the split and **nothing else**. A split we cannot
 * read is a question left unanswered; the rest of the review is still the
 * writer's work and there is no reason to burn it.
 */
function toExaminationSplit(value: Record<string, unknown>): ExaminationSplit {
  const none: ExaminationSplit = { methods: [], shares: [] };

  const { methods, shares } = value;
  if (!Array.isArray(methods) || !Array.isArray(shares)) return none;
  if (methods.length !== shares.length || methods.length === 0) return none;

  const named = methods.filter(isExaminationKey);
  if (named.length !== methods.length) return none;
  if (new Set(named).size !== named.length) return none;

  const sizes = shares.filter(
    (share): share is number => typeof share === "number" && share > 0,
  );
  if (sizes.length !== shares.length) return none;
  if (sizes.reduce((total, share) => total + share, 0) !== 100) return none;

  return { methods: named, shares: sizes };
}

/**
 * A stored record as this build's answers.
 *
 * Total: every record decodes to a draft. The caller has already established
 * that it *is* a record, which is the only thing that can fail.
 */
export function decodeDraftAnswers(
  value: Record<string, unknown>,
): ReviewDraft {
  // Every field named, nothing defaulted from `EMPTY_REVIEW_DRAFT`. See above:
  // the spread is what let a new field drop out of a reload unnoticed.
  return {
    ...toExaminationSplit(value),
    approachTheoryPercent: toScore(value.approachTheoryPercent),
    workloadScore: toScore(value.workloadScore),
    learningScore: toScore(value.learningScore),
    happyTook: typeof value.happyTook === "boolean" ? value.happyTook : null,
    message: typeof value.message === "string" ? value.message : "",
  };
}

/**
 * Whatever a browser handed back, as a draft — or `null` when it is not an
 * object and there is therefore nothing in it to salvage.
 */
export function decodeReviewDraft(value: unknown): ReviewDraft | null {
  return isDraftRecord(value) ? decodeDraftAnswers(value) : null;
}

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

/**
 * Pick or unpick an examination method, re-splitting the bar evenly.
 *
 * Generic over the draft because the workspace pane's draft is this one plus
 * its two "I don't remember" flags, and it has to get its own type back. The
 * cast is sound for exactly the reason the generic is safe: `methods` and
 * `shares` are both declared on `ReviewDraft`, they are the only fields
 * replaced, and everything else is spread through unchanged. TypeScript cannot
 * see that a spread of `D` with two of `D`'s own fields overwritten is still a
 * `D`, so it is asserted here rather than pushed onto three call sites.
 */
export function toggleMethod<D extends ReviewDraft>(
  draft: D,
  method: ExaminationKey,
): D {
  const at = draft.methods.indexOf(method);
  const methods =
    at >= 0 ? draft.methods.toSpliced(at, 1) : [...draft.methods, method];
  return { ...draft, methods, shares: evenShares(methods.length) } as D;
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
export function moveDivider<D extends ReviewDraft>(
  draft: D,
  index: number,
  cumulativePercent: number,
): D {
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
  // Same assertion as `toggleMethod`, for the same reason: only `shares`,
  // already a field of `ReviewDraft`, is replaced.
  return { ...draft, shares } as D;
}

/** Nudge a divider one step, which is how the keyboard drives the bar. */
export function nudgeDivider<D extends ReviewDraft>(
  draft: D,
  index: number,
  steps: number,
): D {
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
