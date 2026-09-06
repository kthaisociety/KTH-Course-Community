/**
 * The cross-feature API of the saved feature.
 *
 * Saving is a relationship other features act on — the course card's Save
 * button and its collection picker both write through it — so the one write
 * path is what crosses the boundary. The `/saved` screen does not: `app/`
 * imports its route component from `components/`, as every page does.
 */

export { useSetCourseSaved } from "./api/mutations";
/**
 * The signed-out half of the same relationship.
 *
 * A guest's saves live in the browser rather than in `user_saved_courses`, so
 * the card's Save button needs both paths and picks by session. Everything
 * about *where* the list is kept stays inside this feature; what crosses the
 * boundary is the same pair the account path exposes — read the list, toggle
 * one course.
 */
export { toggleGuestSave, useGuestSaves } from "./hooks/use-guest-saves";
