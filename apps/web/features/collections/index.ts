/**
 * The cross-feature API of the collections feature.
 *
 * Since #208 the feature reaches a host page in **three** pieces rather than as
 * one component, because on `/saved` its two halves are in different parts of
 * the tree: the chips are the page's narrow band, above the workspace row, and
 * an open collection's detail is inside the scrolling results column below it.
 *
 * - `useCollectionsState` holds everything the two halves share — the query,
 *   the mutations, `?collection=`, the dialog, the note. **Call it once per
 *   page**: it writes the URL, and two writers on one URL is the render-loop
 *   bug this repo has been bitten by before.
 * - `CollectionsStrip` is the band, and `CollectionsBody` is what sits under
 *   it. Both are presentational and both take that one state object.
 *
 * `Collections` stays exported as the `/collections` route's own shell, which
 * calls the hook and renders the body alone — that route has no chip strip and
 * never did. Pages import from `features/<name>/components`, so the route's own
 * import does not come through here.
 *
 * The writes live in `useCollectionMutations` (`@/features/courses`), which the
 * course card's picker shares, so nothing collection-shaped is exported twice.
 */

export { Collections } from "./components/collections";
export {
  COLLECTIONS_SUBTITLE,
  CollectionsBody,
  type CollectionsBodyProps,
} from "./components/collections-body";
export {
  CollectionsStrip,
  type CollectionsStripProps,
} from "./components/collections-strip";
export {
  type CollectionsState,
  useCollectionsState,
} from "./hooks/use-collections-state";
/*
 * `ConfirmDialog` is `@/components/ui/confirm-dialog`, not a re-export from
 * here: seven screens ask a confirmation and no feature owns it.
 */
