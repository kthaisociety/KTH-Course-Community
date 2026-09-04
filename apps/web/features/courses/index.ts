/**
 * The cross-feature API of the courses feature.
 *
 * What Explore (#89), Saved (#90) and Collections (#91) need in order to render
 * a course card, and to manage the collections a card can be put into. The
 * card's mapper and its formatting helpers stay inside the feature, reachable
 * through `CourseCardItem` — a barrel that exports its own internals turns each
 * of them into a promise to three other pages.
 *
 * The collection hooks are the exception, and deliberately so. The card's
 * picker and the Collections page are two surfaces over the same seven
 * procedures; exporting the one hook that holds those writes is what stops the
 * second surface from growing a second write path with its own cache keys.
 */

/** Every `collections` write. Shared by the card's picker and the page. */
export { useCollectionMutations } from "./api/mutations";
export {
  type Collection,
  useCollections,
  useCourseDetails,
  useCourseStats,
  useCourseSummaries,
} from "./api/queries";
/** The presentational card: takes a model, and measures nothing. */
export { CourseCard } from "./components/course-card";
/**
 * What a screen renders, keyed by course code.
 *
 * `useCourseCard` is deliberately not exported. It holds several hooks, so it
 * has to be called from a component that renders exactly one card, and this is
 * that component.
 */
export { CourseCardItem } from "./components/course-card-item";
export { CourseCardWithCharts } from "./components/course-card-with-charts";
export { CourseDetailsSidebar } from "./components/course-details-sidebar";
export { CourseItemSkeleton } from "./components/course-item-skeleton";
export { CoursePageSkeleton } from "./components/course-page-skeleton";
export type { UseCourseCardOptions } from "./hooks/use-course-card";
/**
 * The collapse ramp. The parent owns it: Explore interpolates from its results
 * column, Saved and Collections pin an end.
 */
export {
  CARD_RAMP_CEILING,
  CARD_RAMP_FLOOR,
  COLLAPSED_CARD_GEOMETRY,
  courseCardGeometry,
  EXPANDED_CARD_GEOMETRY,
} from "./lib/card-geometry";
export {
  type CourseCardCourse,
  NO_COURSE_STATS,
} from "./lib/course-card-model";
