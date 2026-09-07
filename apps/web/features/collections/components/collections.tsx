"use client";

import { PageColumn, PageHeader } from "@/features/shell";
import { useCollectionsState } from "../hooks/use-collections-state";
import { COLLECTIONS_SUBTITLE, CollectionsBody } from "./collections-body";

type Props = {
  /**
   * The collection named by `?collection=` on the route, if any.
   *
   * Deep links are why the not-found state is reachable at all. Another user's
   * collection is absent from `collections.list` — ownership is scoped in the
   * query, so the server never learns whether a stranger's id exists — and this
   * page says the same thing the server does: not found, never "not yours".
   */
  openCollectionId?: string | null;
};

/**
 * `/collections`: the viewer's named groups of saved courses, as a page.
 *
 * ## The rule this feature is built around
 *
 * A course may only join a collection its owner has also saved. Composite
 * foreign keys enforce it and `addCourseToCollection` refuses before they have
 * to, so every list of courses offered here — the new-collection dialog and the
 * detail's "Add course" — is derived from `savedCourseCodes` rather than
 * filtered down to it. There is no path that offers an unsaved course and lets
 * the server say no.
 *
 * The same foreign key runs the other way with `on delete cascade`: unsaving a
 * course removes it from every collection it was in. That is the schema's
 * decision, not this feature's, and it is why `collections.list` is the only
 * place membership is read from.
 *
 * ## What is left here, after #208
 *
 * Almost nothing, on purpose. This used to be the whole feature, with a
 * `compact` prop that turned it into a section of Saved. It cannot be that any
 * more: since #208 the chips are Saved's *band* and the detail is inside
 * Saved's scrolling *column*, and one component cannot be in two parts of a
 * tree. So the state lives in {@link useCollectionsState} and the markup in
 * `CollectionsStrip` and `CollectionsBody`; this is the route's own shell
 * around the body.
 *
 * This route has **no chip strip**, and never did. `compact` selected between
 * two presentations of one list — chips for Saved, 150px tiles for this page —
 * and the tiles are in the body, unchanged.
 *
 * ## Where the cards' geometry comes from
 *
 * An open collection's courses are `CourseCardItem`s, and the card never
 * measures anything — its host hands it a `geo`. Embedded in `/saved` that host
 * is Saved, which already measures the column the workspace pane narrows. Here
 * there is no pane, but a browser window is narrowed the same way a pane
 * narrows a column, and the ramp's input is the width itself rather than the
 * reason for it. So the body measures too rather than pinning the expanded end:
 * measuring *is* pinning whenever the column is wide, and unlike pinning it is
 * also right when the column is not.
 */
export function Collections({ openCollectionId = null }: Props) {
  const state = useCollectionsState({ openCollectionId });

  return (
    <PageColumn>
      <PageHeader title="Collections" subtitle={COLLECTIONS_SUBTITLE} />
      <CollectionsBody state={state} />
    </PageColumn>
  );
}
