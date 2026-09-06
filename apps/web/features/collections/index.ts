/**
 * The cross-feature API of the collections feature.
 *
 * `Collections` is exported because it is not only a page: the Saved artboard
 * imports the Collections artboard as a section of itself, so whoever builds
 * Saved renders this component rather than a second copy of it. The route
 * at `app/(service)/collections` renders it too — pages import from
 * `features/<name>/components`, so that import does not come through here.
 *
 * The writes live in `useCollectionMutations` (`@/features/courses`), which the
 * course card's picker shares, so nothing collection-shaped is exported twice.
 */

export { Collections } from "./components/collections";
/*
 * `ConfirmDialog` used to be exported from here, because Saved asks the same
 * question about the same object — unsaving a course cascades it out of every
 * collection it was in, so it is destructive in exactly the way deleting a
 * collection is.
 *
 * That export said what would end it: *"when a third screen needs it, it belongs
 * in `components/ui/` instead."* Seven screens now ask a confirmation, so it is
 * `@/components/ui/confirm-dialog` and Saved imports it directly. Nothing
 * collection-shaped is exported twice, which is why this note replaces the
 * export rather than a re-export standing in for it.
 */
