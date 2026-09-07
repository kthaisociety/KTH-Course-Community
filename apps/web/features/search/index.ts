/**
 * The cross-feature API of the search feature.
 *
 * `Explore` is the workspace. `useSearchCourses`, `useDebouncedQuery` and
 * `CourseSearchField` cross the boundary because a second surface looks courses
 * up in the catalogue: Taken courses has to find the course a reader is adding
 * by hand, and `search.courses` is the only procedure that finds one by code or
 * name. It reuses the hooks rather than wrapping the procedure again, so both
 * surfaces share one query key and one debounce — and it reuses the bar, so
 * both surfaces search from one control rather than two that drift.
 */

export { useSearchCourses } from "./api/queries";
export { CourseSearchField } from "./components/course-search-field";
export { Explore } from "./components/explore";
export { useDebouncedQuery } from "./hooks/use-debounced-query";
