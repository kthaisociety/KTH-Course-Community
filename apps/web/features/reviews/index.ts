/**
 * The cross-feature API of the reviews feature.
 *
 * `selectUnreviewedCourses` is deliberately absent: it is what
 * `useUnreviewedTakenCourses` is made of, and a screen that reached for it
 * directly would be re-deriving the set the hook already derives.
 *
 * So is anything that writes a review other than `useAddReview` and
 * `useEditReview`. The mutations under `api/` are the hooks' own; a surface
 * reaching past them would be a review written without `reviewFormSchema`
 * having seen it, which is the one thing this feature exists to prevent.
 */

export {
  type TakenCourse,
  type UnreviewedTakenCourse,
  useReviewList,
  useUnreviewedTakenCourses,
} from "./api/queries";
/** One published review, and the list that wires it to the API. */
export { ReviewCard, type ReviewCardProps } from "./components/review-card";
/**
 * The blocks a stored review is read in: its examination split, its
 * theory/applied bar, and its two 1-10 meters.
 *
 * Shared because a review is read back in two places that are not the same
 * component — the expanded Review Card, and My Page's review detail — and the
 * artboards draw one set of blocks for both. `UnansweredPanel` is exported with
 * them because "I don't remember" has to look the same wherever it is read.
 */
export {
  ExaminationBlock,
  Meter,
  ProfileBlock,
  SectionHead,
  UnansweredPanel,
} from "./components/review-detail-blocks";
/** The form a review is written and rewritten in, and the two hosts that draw it. */
export {
  ReviewDraftEditor,
  type ReviewDraftEditorProps,
} from "./components/review-draft-editor";
export { ReviewList } from "./components/review-list";
/** The fast-track card stack, and the shape of one course in its queue. */
export { Reviewer, type ReviewerProps } from "./components/reviewer";
export type { ReviewerCardCourse } from "./components/reviewer-card";
/**
 * The score controls, exported because the review editor draws the same 1-10
 * score the reviewer card does. They were two near-verbatim copies that had
 * drifted three ways, one of them a dark-theme-only wrong fill colour; see
 * `components/score-controls.tsx` for what each divergence was.
 */
export {
  APPLIED_FILL,
  ScoreSlider,
  UNSET_FILL,
  ValuePill,
} from "./components/score-controls";
/** The prompt for taken courses with no review — Taken courses and My Page. */
export {
  UnreviewedCard,
  type UnreviewedCourse,
} from "./components/unreviewed-card";
export { useAddReview } from "./hooks/use-add-review";
export { useEditReview } from "./hooks/use-edit-review";
export { useRemoveReview } from "./hooks/use-remove-review";
export {
  EXAMINATION_COLORS,
  EXAMINATION_INK,
  type ExaminationSegment,
  examinationSegments,
  examinationSplitLabel,
} from "./lib/examination-palette";
/**
 * The answers in a review being written, and the arithmetic behind the
 * draggable examination bar.
 *
 * `isAnswered` is the rule both forms apply before they offer to send anything.
 * The bar transforms are exported for nothing outside this feature today — the
 * one editor that drives them lives here — but they are the model's public
 * surface and they belong beside it.
 */
export {
  APPROACH_MAX,
  APPROACH_MIDPOINT,
  APPROACH_MIN,
  dividerPositions,
  EMPTY_REVIEW_ANSWERS,
  type ExaminationKey,
  isAnswered,
  MIN_SHARE,
  moveDivider,
  nudgeDivider,
  type ReviewAnswers,
  toggleMethod,
} from "./lib/review-answers";
/**
 * The review draft: a review being written or rewritten in the full editor,
 * which is the answers above plus the two "I don't remember" flags the editor
 * draws checkboxes for.
 *
 * `toReviewDraft` is what makes editing possible at all — a stored `Review`,
 * back in the form that writes one — and `toReviewFormData` is the only way
 * either shape becomes something writable.
 *
 * The pure modules that hold a draft in browser storage import
 * `./lib/review-draft` by path rather than through this barrel. Types are
 * erased and cost nothing, but the barrel's *values* reach the components above
 * and drag React and a DOM into a module that is arithmetic — and into the
 * `logic` vitest project, whose whole point is a node environment with neither.
 */
export {
  EMPTY_REVIEW_DRAFT,
  REVIEW_DRAFT_SECTIONS,
  type ReviewDraft,
  sectionsDone,
  toReviewDraft,
  toReviewFormData,
} from "./lib/review-draft";
export type { ReviewFormData } from "./lib/review-form-schema";
/**
 * The reviewer's round, as the tab remembers it. `/taken` reads it to reopen a
 * round a reload interrupted — after checking that its courses are still
 * unreviewed, which the store itself cannot know — and clears it when the
 * reader leaves the stack.
 */
export {
  clearReviewerSession,
  type ReviewerSession,
  readReviewerSession,
} from "./lib/reviewer-session";
