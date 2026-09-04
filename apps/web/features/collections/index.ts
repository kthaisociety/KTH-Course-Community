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
