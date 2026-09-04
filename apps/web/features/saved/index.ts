/**
 * The cross-feature API of the saved feature.
 *
 * Saving is a relationship other features act on — the course card's Save
 * button and its collection picker both write through it — so the one write
 * path is what crosses the boundary. The `/saved` screen does not: `app/`
 * imports its route component from `components/`, as every page does.
 */

export { useSetCourseSaved } from "./api/mutations";
