"use client";

import { Check, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AuthReasonDialog, SignInPrompt } from "@/features/auth";
import type { OpenCourseKind } from "@/features/workspace";
import type { CollectionsState } from "../hooks/use-collections-state";
import { CollectionDetail } from "./collection-detail";
import { CollectionTile } from "./collection-tile";
import { EmptyPanel } from "./empty-panel";
import { NewCollectionDialog } from "./new-collection-dialog";

const SKELETON_KEYS = ["c0", "c1", "c2"] as const;

/**
 * The line under the standalone page's header.
 *
 * `Course Community - Collections.dc.html` reads "Group courses you want to
 * compare." — and the "New collection" tile beside it reads "Group specific
 * courses and compare them side by side." Neither is true: there is no
 * comparison surface anywhere in the app, and #68's settled decision 1 is that
 * there is no AI-comparison feature to build one for. So neither the heading
 * nor the tile promises one, and both use the same wording.
 *
 * It is a copy change against the visual authority, which is the narrow case
 * `CLAUDE.md` allows: the design loses to the schema on what exists, and it is
 * the smallest edit that leaves the artboard otherwise intact — same slot, same
 * length, same voice.
 */
export const COLLECTIONS_SUBTITLE =
  "Group the courses you are considering together.";

/**
 * Where a course opened from a collection goes: Saved, with the collection kept
 * open behind the pane it lands in.
 *
 * Carrying `?collection=` through matters when this is the embedded body of
 * `/saved` — the navigation is then onto the route the reader is already on, and
 * dropping the parameter would close the detail out from under them.
 */
function savedPaneHref(
  collectionId: string,
  courseCode: string,
  kind: OpenCourseKind = "details",
): string {
  return `/saved?collection=${encodeURIComponent(collectionId)}&open=${encodeURIComponent(courseCode)}&kind=${kind}`;
}

export interface CollectionsBodyProps {
  /** One `useCollectionsState` call, shared with `CollectionsStrip`. */
  state: CollectionsState;
  /**
   * True when the strip is rendering the list elsewhere — `/saved`, where the
   * chips are the page's band and this is only what sits under them.
   *
   * It is what used to be `compact`, and it still selects between the same two
   * things: the chips (now the strip's) and the 150px tiles (still here). The
   * signed-out invitation splits the same way — one line in the band there, the
   * full card here, because `/collections` has a whole page for it.
   */
  embedded?: boolean;
}

/**
 * Everything a collection shows *below* the band: the confirmation note, an
 * open collection's detail, and — on `/collections` — the tiles.
 *
 * ## Why the detail stays down here
 *
 * `saved.tsx` has recorded since it was built that a fixed-height block above
 * the workspace row clips a long open collection, because that row owns the
 * page's only scroll. #208 moves the *chips* up into the band and leaves the
 * *detail* here, for exactly that reason. Both halves of the old note survive
 * the split.
 *
 * ## Why the note is here and not in the band
 *
 * A 3-second confirmation that resized the band would shift both pages' tab
 * strips for its lifetime, and the band's height is the whole mechanism
 * levelling them. It goes above the list instead, in the column that scrolls.
 */
export function CollectionsBody({
  state,
  embedded = false,
}: Readonly<CollectionsBodyProps>) {
  const router = useRouter();
  const { openCollectionRecord } = state;

  return (
    <>
      {/* The live region is always in the tree and out of the flow: a region
          that appears already carrying its text announces nothing, because
          there was no change for a screen reader to notice. The strip below is
          the same words, drawn.

          It is a **sibling** of the block below rather than its first child,
          which matters embedded: that block collapses itself with
          `empty:hidden` when there is neither a note nor an open detail, and a
          permanently-mounted child would make it permanently non-empty — 28px
          of padding above Saved's list, on every view that has no collection
          open. */}
      <div aria-live="polite" className="sr-only">
        {state.note?.text ?? ""}
      </div>

      <section
        /*
          Embedded this is a named region under Saved's band; standalone it is
          the page's own content under its `h1`, and a `<section>` with no
          accessible name is not exposed as a landmark at all, so the same
          element serves both without naming the page's subject twice.
        */
        aria-label={embedded ? "Collections" : undefined}
        // The measured box is the one the cards are laid out in, so its content
        // width is exactly what they have to share. Embedded, `geo` is already
        // supplied and this measurement goes unread rather than unmade — one
        // `ResizeObserver` on a box that exists either way is cheaper than a
        // conditional hook could ever be.
        ref={state.columnRef}
        className={
          embedded
            ? "flex flex-col gap-3.5 pt-[18px] pb-2.5 empty:hidden @max-[440px]:pt-3"
            : "flex flex-col gap-3.5 px-7 pt-[18px]"
        }
      >
        {state.note ? (
          <div
            aria-hidden
            className="flex items-center gap-2 rounded-[9px] border border-cc-rule2 bg-cc-pill px-[13px] py-[9px] text-[12.5px] text-cc-brand"
          >
            <Check size={14} />
            {state.note.text}
          </div>
        ) : null}

        {/*
          Embedded, the band carries its own placeholders and the page's saved
          list carries its own — a third set of skeletons here would be the same
          wait said three times. Only a collection that is still resolving needs
          one, because nothing else on the page is standing in for it.
        */}
        {state.isLoading && (!embedded || state.openId !== null) ? (
          /*
            The tile's own silhouette — `CollectionTile` is `min-h-[150px]` at a
            11px radius — in the app's loading idiom: a pulsing block the size of
            what is coming, the way Saved, Explore, My Page and Taken all do it.
          */
          <ul className="flex list-none flex-col gap-3.5 p-0">
            {(embedded ? SKELETON_KEYS.slice(0, 1) : SKELETON_KEYS).map(
              (key) => (
                <li key={key}>
                  <div className="h-[150px] animate-pulse rounded-[11px] border border-cc-rule bg-cc-surface" />
                </li>
              ),
            )}
          </ul>
        ) : null}

        {/*
          The invitation to sign in on `/collections`. Embedded there is none
          here at all: Saved puts it in the band instead — see
          `CollectionsStrip`'s `GuestRow`, and #208 for why a 120px card cannot
          sit in a band that levels two pages.

          It is the same `SignInPrompt` the band draws. The two used to be
          different shapes for that reason, and the slim one won: a card that
          fits the band fits a page as well, and the reverse was never true.
        */}
        {!state.isLoading && !state.signedIn && !embedded ? (
          <SignInPrompt
            title="Organize your saved courses into collections"
            action={{
              kind: "ask",
              onSignUp: () => state.setAuthReason("sign-up"),
              onLogIn: () => state.setAuthReason("log-in"),
            }}
          />
        ) : null}

        {!state.isLoading &&
        state.signedIn &&
        state.openId !== null &&
        !openCollectionRecord ? (
          <EmptyPanel
            title="Collection not found"
            body="There is no such collection. It may have been deleted."
            action={{
              label: "All collections",
              onClick: () => state.openCollection(null),
            }}
          />
        ) : null}

        {!state.isLoading && state.signedIn && openCollectionRecord ? (
          <CollectionDetail
            collection={openCollectionRecord}
            geo={state.cardGeo}
            courseFor={(courseCode) => state.savedByCode.get(courseCode)}
            addableCourseCodes={state.addableFor(openCollectionRecord)}
            hasSavedCourses={state.savedCourseCodes.length > 0}
            onBack={() => state.openCollection(null)}
            onRename={(name) => state.onRename(openCollectionRecord, name)}
            onDelete={() => state.requestDelete(openCollectionRecord)}
            onAddCourse={(courseCode) =>
              state.onAddCourse(openCollectionRecord, courseCode)
            }
            onRemoveCourse={(courseCode) =>
              state.onRemoveCourse(openCollectionRecord, courseCode)
            }
            onMoveCourse={(courseCode, direction) =>
              state.onMoveCourse(openCollectionRecord, courseCode, direction)
            }
            /*
              A course opens in the workspace pane, and this component does not
              host one: the design reaches collections only through Saved, and
              Saved is where the pane is mounted. So both controls hand the
              course to that route, which spends `?open=` on arrival and puts
              the collection straight back in the URL.
            */
            onOpenCourse={(courseCode) =>
              router.push(savedPaneHref(openCollectionRecord.id, courseCode))
            }
            onReviewCourse={(courseCode) =>
              router.push(
                savedPaneHref(openCollectionRecord.id, courseCode, "review"),
              )
            }
            onRequestAuth={state.setAuthReason}
          />
        ) : null}

        {/*
          The tiles, and the standalone page's own empty state. Embedded, this
          list is the band's chips instead — one list, two presentations, which
          is what `compact` used to select between and what `embedded` selects
          between now.
        */}
        {!state.isLoading &&
        state.signedIn &&
        state.openId === null &&
        state.collections &&
        !embedded ? (
          state.collections.length === 0 ? (
            <EmptyPanel
              title="No collections yet"
              body="Create a collection to organize courses you are considering together."
              action={{
                label: "Create collection",
                onClick: state.openDialog,
              }}
            />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
              <button
                type="button"
                onClick={state.openDialog}
                className="box-border flex min-h-[150px] cursor-pointer flex-col items-center justify-center gap-[7px] rounded-[11px] border border-cc-hov border-dashed bg-cc-info p-[15px_16px] hover:border-cc-brand"
              >
                <span className="flex items-center gap-2 font-semibold text-[16px] text-cc-brand">
                  <Plus size={18} aria-hidden />
                  New collection
                </span>
                <span className="max-w-[190px] text-center text-[12px] text-cc-muted leading-[1.5]">
                  Group specific courses you are considering together.
                </span>
              </button>

              {state.collections.map((collection) => (
                <CollectionTile
                  key={collection.id}
                  collection={collection}
                  courseFor={(courseCode) =>
                    state.savedByCode.get(courseCode)?.course
                  }
                  onOpen={() => state.openCollection(collection.id)}
                  onRename={(name) => state.onRename(collection, name)}
                  onDelete={() => state.requestDelete(collection)}
                />
              ))}
            </div>
          )
        ) : null}
      </section>

      <NewCollectionDialog
        open={state.dialogOpen}
        savedCourses={state.savedCourses}
        onClose={state.closeDialog}
        onCreate={state.onCreate}
      />

      {/*
        One dialog for all three entry points, rendered by the part that is
        always mounted rather than by each menu — a tile and a chip both unmount
        the moment the collection goes, and a dialog inside one of them would be
        asking the question from inside the thing being deleted. The chip that
        asks now lives in the band, which is a second reason the question cannot
        be asked from there.

        The body names what is lost and what is not: the collection and the
        order its courses were put in, never the courses, which stay saved and
        stay in whatever other collections hold them.
      */}
      <ConfirmDialog
        request={
          state.pendingDelete
            ? {
                eyebrow: "Collections",
                title: `Delete “${state.pendingDelete.name}”?`,
                body: "This deletes the collection and the order you put its courses in. The courses themselves stay saved, and stay in any other collection that holds them. A deleted collection cannot be restored.",
                cancelLabel: "Keep collection",
                actionLabel: "Delete collection",
              }
            : null
        }
        onCancel={state.cancelDelete}
        onConfirm={state.onConfirmDelete}
      />

      {/* Only when nobody else is showing one. An embedded copy would put two
          dialogs over one page, each with its own idea of why. */}
      {state.ownsAuthDialog ? (
        <AuthReasonDialog
          reason={state.ownAuthReason}
          onReasonChange={state.setOwnAuthReason}
          onClose={() => state.setOwnAuthReason(null)}
        />
      ) : null}
    </>
  );
}
