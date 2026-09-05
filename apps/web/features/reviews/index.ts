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
  useReviewList,
  useUnreviewedTakenCourses,
} from "./api/queries";
export {
  type EditableReview,
  Review,
  type ReviewFormData,
  toEditableReview,
} from "./components/review";
/** One published review, and the list that wires it to the API. */
export { ReviewCard, type ReviewCardProps } from "./components/review-card";
export { ReviewList } from "./components/review-list";
/** The fast-track card stack, and the shape of one course in its queue. */
export { Reviewer, type ReviewerProps } from "./components/reviewer";
export type { ReviewerCardCourse } from "./components/reviewer-card";
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
