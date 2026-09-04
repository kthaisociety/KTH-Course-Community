/**
 * The cross-feature API of the courses feature.
 *
 * What Explore (#89), Saved (#90) and Collections (#91) need in order to render
 * a course card, and nothing else. The card's mapper, its formatting helpers
 * and the tRPC hooks behind the picker are all reachable through
 * `CourseCardItem`, so they stay inside the feature — a barrel that exports its
 * own internals turns each of them into a promise to three other pages.
 */

export {
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
