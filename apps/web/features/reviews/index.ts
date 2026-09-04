/**
 * The cross-feature API of the reviews feature.
 *
 * `selectUnreviewedCourses` is deliberately absent: it is what
 * `useUnreviewedTakenCourses` is made of, and a screen that reached for it
 * directly would be re-deriving the set the hook already derives.
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
