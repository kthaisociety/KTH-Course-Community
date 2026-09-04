/**
 * The cross-feature API of the search feature.
 *
 * `Explore` is the workspace. `useSearchCourses` and `useDebouncedQuery` cross
 * the boundary because a second surface looks courses up in the catalogue:
 * Taken courses (#92) has to find the course a reader is adding by hand, and
 * `search.courses` is the only procedure that finds one by code or name. It
 * reuses this hook rather than wrapping the procedure again, so both surfaces
 * share one query key and one debounce.
 */

export { useSearchCourses } from "./api/queries";
export { Explore } from "./components/explore";
export { useDebouncedQuery } from "./hooks/use-debounced-query";
