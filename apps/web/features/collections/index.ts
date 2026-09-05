/**
 * The cross-feature API of the collections feature.
 *
 * `Collections` is exported because it is not only a page: the Saved artboard
 * imports the Collections artboard as a section of itself, so whoever builds
 * Saved (#90) renders this component rather than a second copy of it. The route
 * at `app/(service)/collections` renders it too — pages import from
 * `features/<name>/components`, so that import does not come through here.
 *
 * The writes live in `useCollectionMutations` (`@/features/courses`), which the
 * course card's picker shares, so nothing collection-shaped is exported twice.
 */

export { Collections } from "./components/collections";
/**
 * The artboard's confirmation, exported because Saved asks the same question
 * about the same object.
 *
 * Unsaving a course is destructive in exactly the way deleting a collection is:
 * `user_saved_courses` is the composite foreign key every `collection_courses`
 * row hangs off, so an unsave cascades the course out of every collection it
 * was in and takes its place in each of their orders with it. One dialog asks
 * both questions (#155). It lives here because collections is where the first
 * of them is asked; when a third screen needs it, it belongs in
 * `components/ui/` instead.
 */
export {
  ConfirmDialog,
  type ConfirmRequest,
} from "./components/confirm-dialog";
