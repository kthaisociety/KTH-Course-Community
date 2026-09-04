/**
 * The cross-feature API of the taken feature.
 *
 * Taking a course is a relationship other surfaces act on — the course card
 * marks one taken, and this page adds, edits and removes them — so the write
 * path is what crosses the boundary. The `/taken` screen does not: `app/`
 * imports its route component from `components/`, as every page does.
 *
 * `useTakenMutations`' `add` is the card's own `useMarkCourseTaken`, so
 * `taken.add` still has exactly one write path and one set of cache keys.
 */

export { useTakenMutations } from "./api/mutations";
