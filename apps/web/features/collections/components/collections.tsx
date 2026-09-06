"use client";

import { Check, Lock, Plus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { type AuthReason, AuthReasonDialog, useMe } from "@/features/auth";
import {
  addableCourseCodes,
  moveCourse,
} from "@/features/collections/lib/collection-model";
import {
  type Collection,
  courseCardGeometry,
  useCollectionMutations,
  useCollections,
  useCourseSummaries,
} from "@/features/courses";
import { PageColumn, PageHeader } from "@/features/shell";
import { type OpenCourseKind, useResultsWidth } from "@/features/workspace";
import type { CardGeometry } from "@/types";
import { CollectionChip } from "./collection-chip";
import { CollectionDetail, type SavedCourse } from "./collection-detail";
import { CollectionTile } from "./collection-tile";
import { EmptyPanel } from "./empty-panel";
import { NewCollectionDialog } from "./new-collection-dialog";

/** Names the compact variant's section by its own heading. */
const COMPACT_HEADING_ID = "collections-section-heading";

/**
 * The line under the heading, in both variants.
 *
 * `Course Community - Collections.dc.html` reads "Group courses you want to
 * compare." — and the "New collection" tile beside it reads "Group specific
 * courses and compare them side by side." Neither is true: there is no
 * comparison surface anywhere in the app, and #68's settled decision 1 is that
 * there is no AI-comparison feature to build one for. #91 already dropped the
 * promise from the tile; this is the same substitution finished, so the page
 * does not head itself with a promise its own tile has stopped making. The
 * wording is the tile's, so the two agree.
 *
 * It is a copy change against the visual authority, which is the narrow case
 * `CLAUDE.md` allows: the design loses to the schema on what exists, and it is
 * the smallest edit that leaves the artboard otherwise intact — same slot, same
 * length, same voice.
 */
const SUBTITLE = "Group the courses you are considering together.";

/** How long the artboard's confirmation strip stays up, in milliseconds. */
const NOTE_LIFETIME = 3000;

const SKELETON_KEYS = ["c0", "c1", "c2"] as const;

/**
 * Where a course opened from a collection goes: Saved, with the collection kept
 * open behind the pane it lands in.
 *
 * Carrying `?collection=` through matters when this is the embedded section of
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
  /**
   * The Saved page's embedding of this component, from
   * `Course Community - Saved.dc.html` line 82. Collections becomes a strip of
   * chips above Saved's own list rather than a page: no `PageColumn`, no `h1`,
   * and an `h2` where the page has its header. The detail below it is the same
   * component either way.
   */
  compact?: boolean;
  /**
   * Which collection is open, told to whoever embeds this.
   *
   * Saved hides its own list of cards while a detail is open — the artboard's
   * `showSavedSection: !this.state.collectionsOpenDetail` — and only this
   * component knows when that changed.
   */
  onDetailChange?: (collectionId: string | null) => void;
  /**
   * The host page's sign-in surface. Passed when this is embedded, because two
   * `AuthReasonDialog`s in one tree are two dialogs racing for one screen; the
   * page renders its own when this is absent.
   */
  onRequestAuth?: (reason: AuthReason) => void;
  /**
   * The card collapse ramp for an open collection's courses, when the host has
   * already measured the column they land in.
   *
   * `/saved` embeds this inside the very column `WorkspacePaneHost` narrows, so
   * the geometry it computes for its own list is the geometry these cards need
   * too — one card behaving two ways in one page is what #159 reports. Left
   * out, this component measures the column it is standing in itself, which is
   * what the `/collections` route does; see {@link Collections} for why that is
   * a measurement there rather than the pinned expanded end.
   */
  geo?: CardGeometry;
};

/**
 * Collections: the viewer's named groups of saved courses, and the whole of
 * what they can do to them.
 *
 * ## The rule this page is built around
 *
 * A course may only join a collection its owner has also saved. Composite
 * foreign keys enforce it and `addCourseToCollection` refuses before they have
 * to, so every list of courses this page offers — the new-collection dialog and
 * the detail's "Add course" — is derived from `savedCourseCodes` rather than
 * filtered down to it. There is no path here that offers an unsaved course and
 * lets the server say no.
 *
 * The same foreign key runs the other way with `on delete cascade`: unsaving a
 * course removes it from every collection it was in. That is the schema's
 * decision, not this page's, and it is why `collections.list` is the only place
 * membership is read from.
 *
 * ## Where it sits
 *
 * `Course Community - Saved.dc.html` imports the Collections artboard as a
 * section of the Saved page, in its `compact` variant. That embedding is Saved's
 * to build; this is the same component as a page of its own, so the
 * feature is reachable and usable before Saved exists. The `compact` chip row
 * is built and Saved is its caller — the sentence that used to stand here said
 * it had none, which stopped being true when #90 landed.
 *
 * ## What the writes do about failure
 *
 * Creating a collection with courses in it is `collections.create` and then one
 * `collections.addCourse` per course, in order, because position is appended in
 * call order and a parallel batch would file them arbitrarily. Each step can
 * fail on its own, so the message names the step that did: saying "could not
 * create" after a failed *add* would send the reader back to the name field,
 * and `collections.create` has no uniqueness on name, so typing it again makes a
 * second empty collection.
 *
 * ## Deleting asks first
 *
 * All three ways to delete a collection — the detail's button, the tile's menu
 * and the chip's menu — hand the collection to one confirmation rather than to
 * the mutation. The artboards confirm *after*, with a note; #155 settled that
 * they lose here, because what is destroyed cannot be put back. Restoring a
 * deleted collection means `create` and then one `addCourse` per course in
 * order — `reorderCollectionCourses` throws `NotFoundError` for a code that is
 * not already a member, so it can never add one — and `addCourseToCollection`
 * throws `ForbiddenError` for a course unsaved in the meantime. An undo that
 * comes back partial is not an undo, so the question is asked while the answer
 * is still free. The note stays: it is what says the deletion happened.
 *
 * ## Where the cards' geometry comes from
 *
 * An open collection's courses are `CourseCardItem`s, and the card never
 * measures anything — its host hands it a `geo`. Embedded in `/saved` that host
 * is Saved, which already measures the column the workspace pane narrows. As a
 * page there is no pane, but a browser window is narrowed the same way a pane
 * narrows a column, and the ramp's input is the width itself rather than the
 * reason for it. So this measures too rather than pinning the expanded end:
 * measuring *is* pinning whenever the column is wide, and unlike pinning it is
 * also right when the column is not.
 */
export function Collections({
  openCollectionId = null,
  compact = false,
  onDetailChange,
  onRequestAuth,
  geo,
}: Props) {
  const router = useRouter();
  // The route this is rendered on owns `?collection=`, so an embedded detail
  // is shareable and survives a refresh on the page it was opened from rather
  // than sending the reader to `/collections`.
  const pathname = usePathname();
  const { user, isLoading: sessionLoading } = useMe();
  const signedIn = user !== null;
  const savedCourseCodes = user?.savedCourseCodes ?? [];

  const {
    data: collections,
    isPending: collectionsPending,
    isFetching: collectionsFetching,
  } = useCollections(signedIn);
  const summaries = useCourseSummaries(savedCourseCodes, signedIn);
  const { create, rename, deleteCollection, reorder, addCourse, removeCourse } =
    useCollectionMutations();

  /**
   * The column an open collection's cards land in, when nobody has measured it
   * for us. `useResultsWidth` starts at `Infinity`, which is the top of the ramp
   * — so the first paint, the server's render and jsdom (which lays nothing out)
   * all draw the fully expanded card this page used to pin, and the ramp only
   * moves once something has actually measured a narrower column.
   */
  const [columnRef, columnWidth] = useResultsWidth();
  const cardGeo = geo ?? courseCardGeometry(columnWidth);

  const [openId, setOpenId] = useState<string | null>(openCollectionId);
  const [dialogOpen, setDialogOpen] = useState(false);
  /**
   * The confirmation strip. A fresh object every time, so that saying the same
   * thing twice is a state change React does not skip — and the timer under it
   * restarts rather than expiring on the first message's clock.
   */
  const [note, setNote] = useState<{ text: string } | null>(null);
  /**
   * The collection a delete has been asked about and not yet answered.
   *
   * The collection itself rather than its id: the dialog names it, and the
   * record can leave `collections.list` between the question and the answer —
   * another tab deleting it, or the refetch after this one lands. Holding the
   * record means the words on screen never blank out mid-question.
   */
  const [pendingDelete, setPendingDelete] = useState<Collection | null>(null);
  const [ownAuthReason, setOwnAuthReason] = useState<AuthReason | null>(null);
  const setAuthReason = onRequestAuth ?? setOwnAuthReason;

  const showNote = useCallback((text: string) => setNote({ text }), []);

  useEffect(() => {
    if (!note) return;
    const timer = setTimeout(() => setNote(null), NOTE_LIFETIME);
    return () => clearTimeout(timer);
  }, [note]);

  // The route is the authority on what is open: a link to `/collections` from
  // the rail while a collection is open has to close it, and only the prop
  // knows that happened.
  useEffect(() => setOpenId(openCollectionId), [openCollectionId]);

  /** Keeps the route in step with what is open, so a refresh lands back here. */
  const openCollection = useCallback(
    (collectionId: string | null) => {
      setOpenId(collectionId);
      onDetailChange?.(collectionId);
      router.replace(
        collectionId
          ? `${pathname}?collection=${encodeURIComponent(collectionId)}`
          : pathname,
        { scroll: false },
      );
    },
    [router, pathname, onDetailChange],
  );

  // Every course this page can show is a saved course: a collection cannot hold
  // one that is not, so `savedCourseCodes` is the whole set of summaries needed
  // for the tiles' previews, the detail's cards and both pickers.
  const savedByCode = new Map<string, SavedCourse>();
  for (const summary of summaries) {
    const course = summary.data;
    if (!course) continue;
    savedByCode.set(course.courseCode, {
      course: {
        courseCode: course.courseCode,
        titleEng: course.titleEng,
        credits: course.credits,
        department: course.department,
      },
      stats: course.stats,
    });
  }
  // Keyed on the saved codes, not on the summaries that have arrived: a course
  // whose title is still in flight is still addable, and dropping it would make
  // the dialog and the detail's "Add course" disagree about what can be added.
  const savedCourses = savedCourseCodes.map(
    (courseCode) =>
      savedByCode.get(courseCode)?.course ?? {
        courseCode,
        titleEng: "",
        credits: null,
        department: null,
      },
  );

  const openCollectionRecord =
    collections?.find((collection) => collection.id === openId) ?? null;

  /**
   * A collection that is open but not in the list yet is still arriving, not
   * missing. Creating one opens it before its refetch lands, and saying "not
   * found" for that frame would accuse the app of losing what it just made.
   */
  const resolvingOpen =
    openId !== null && !openCollectionRecord && collectionsFetching;

  async function onCreate(name: string, courseCodes: string[]) {
    let created: { id: string };
    try {
      created = await create.mutateAsync({ name });
    } catch {
      toast.error(`Could not create the collection "${name}".`);
      return;
    }

    const failed: string[] = [];
    for (const courseCode of courseCodes) {
      try {
        await addCourse.mutateAsync({ collectionId: created.id, courseCode });
      } catch {
        failed.push(courseCode);
      }
    }

    openCollection(created.id);
    if (failed.length === 0) {
      showNote(`Collection "${name}" created`);
    } else {
      toast.error(
        `Created "${name}", but could not add ${failed.join(", ")}. Add them from the collection.`,
      );
    }
  }

  function onRename(collection: Collection, name: string) {
    rename
      .mutateAsync({ collectionId: collection.id, name })
      .catch(() =>
        toast.error(`Could not rename "${collection.name}" to "${name}".`),
      );
  }

  /** Confirms the deletion; nothing is written until the reader answers. */
  function onConfirmDelete() {
    const collection = pendingDelete;
    setPendingDelete(null);
    if (!collection) return;

    deleteCollection
      .mutateAsync({ collectionId: collection.id })
      .then(() => {
        if (openId === collection.id) openCollection(null);
        showNote(`Collection "${collection.name}" deleted`);
      })
      .catch(() => toast.error(`Could not delete "${collection.name}".`));
  }

  function onAddCourse(collection: Collection, courseCode: string) {
    addCourse
      .mutateAsync({ collectionId: collection.id, courseCode })
      .catch(() =>
        toast.error(`Could not add ${courseCode} to "${collection.name}".`),
      );
  }

  function onRemoveCourse(collection: Collection, courseCode: string) {
    removeCourse
      .mutateAsync({ collectionId: collection.id, courseCode })
      .catch(() =>
        toast.error(
          `Could not remove ${courseCode} from "${collection.name}".`,
        ),
      );
  }

  function onMoveCourse(
    collection: Collection,
    courseCode: string,
    direction: "up" | "down",
  ) {
    const courseCodes = moveCourse(
      collection.courseCodes,
      courseCode,
      direction,
    );
    reorder
      .mutateAsync({ collectionId: collection.id, courseCodes })
      .catch(() => toast.error(`Could not reorder "${collection.name}".`));
  }

  const isLoading =
    sessionLoading || (signedIn && collectionsPending) || resolvingOpen;

  const body = (
    <>
      <div
        // The measured box is the one the cards are laid out in, so its content
        // width is exactly what they have to share. Embedded, `geo` is already
        // supplied and this measurement goes unread rather than unmade — one
        // `ResizeObserver` on a box that exists either way is cheaper than a
        // conditional hook could ever be.
        ref={columnRef}
        className={
          compact
            ? "mt-3.5 flex flex-col gap-3.5"
            : "flex flex-col gap-3.5 px-7 pt-[18px]"
        }
      >
        {/* The live region is always in the tree and out of the flow: a region
            that appears already carrying its text announces nothing, because
            there was no change for a screen reader to notice. The strip below
            is the same words, drawn. */}
        <div aria-live="polite" className="sr-only">
          {note?.text ?? ""}
        </div>
        {note ? (
          <div
            aria-hidden
            className="flex items-center gap-2 rounded-[9px] border border-cc-rule2 bg-cc-pill px-[13px] py-[9px] text-[12.5px] text-cc-brand"
          >
            <Check size={14} />
            {note.text}
          </div>
        ) : null}

        {isLoading ? (
          /*
            The tile's own silhouette — `CollectionTile` is `min-h-[150px]` at a
            11px radius — in the app's loading idiom: a pulsing block the size of
            what is coming, the way Saved, Explore, My Page and Taken all do it.

            This was `CourseItemSkeleton`, a 280px two-column shadcn `Card` whose
            own docstring called it legacy and which drew a course card, not a
            collection. It was the wrong shape, the wrong height and the wrong
            palette, and it is gone.
          */
          <ul className="flex list-none flex-col gap-3.5 p-0">
            {SKELETON_KEYS.map((key) => (
              <li key={key}>
                <div className="h-[150px] animate-pulse rounded-[11px] border border-cc-rule bg-cc-surface" />
              </li>
            ))}
          </ul>
        ) : null}

        {!isLoading && !signedIn ? (
          <div className="max-w-[520px] rounded-[11px] border border-cc-rule2 bg-cc-surface p-[16px_17px]">
            <div className="flex items-center gap-2">
              <Lock size={15} className="text-cc-dim" aria-hidden />
              <div className="font-semibold text-[13.5px]">
                Organize your saved courses
              </div>
            </div>
            <div className="mt-1.5 text-[12.5px] text-cc-muted leading-[1.5]">
              Sign up or log in to create collections and sync across devices.
            </div>
            <div className="mt-[11px] flex gap-[7px]">
              <button
                type="button"
                onClick={() => setAuthReason("sign-up")}
                className="flex h-8 cursor-pointer items-center rounded-[8px] bg-cc-btn px-3.5 font-semibold text-[12.5px] text-cc-btn-fg hover:opacity-[0.88]"
              >
                Sign up
              </button>
              <button
                type="button"
                onClick={() => setAuthReason("log-in")}
                className="flex h-8 cursor-pointer items-center rounded-[8px] border border-cc-rule3 bg-cc-surface px-3.5 font-medium text-[12.5px] text-cc-brand hover:border-cc-hov"
              >
                Log in
              </button>
            </div>
          </div>
        ) : null}

        {!isLoading && signedIn && openId !== null && !openCollectionRecord ? (
          <EmptyPanel
            title="Collection not found"
            body="There is no such collection. It may have been deleted."
            action={{
              label: "All collections",
              onClick: () => openCollection(null),
            }}
          />
        ) : null}

        {!isLoading && signedIn && openCollectionRecord ? (
          <CollectionDetail
            collection={openCollectionRecord}
            geo={cardGeo}
            courseFor={(courseCode) => savedByCode.get(courseCode)}
            addableCourseCodes={addableCourseCodes(
              savedCourseCodes,
              openCollectionRecord.courseCodes,
            )}
            hasSavedCourses={savedCourseCodes.length > 0}
            onBack={() => openCollection(null)}
            onRename={(name) => onRename(openCollectionRecord, name)}
            onDelete={() => setPendingDelete(openCollectionRecord)}
            onAddCourse={(courseCode) =>
              onAddCourse(openCollectionRecord, courseCode)
            }
            onRemoveCourse={(courseCode) =>
              onRemoveCourse(openCollectionRecord, courseCode)
            }
            onMoveCourse={(courseCode, direction) =>
              onMoveCourse(openCollectionRecord, courseCode, direction)
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
            onRequestAuth={setAuthReason}
          />
        ) : null}

        {!isLoading && signedIn && openId === null && collections ? (
          compact ? (
            // The artboard keeps the "New collection" chip in the row whether or
            // not any collection exists, so the compact variant has no separate
            // empty panel: the row already says what to do.
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDialogOpen(true)}
                className="box-border flex h-10 flex-none cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[9px] border border-cc-hov border-dashed bg-cc-info px-[13px] font-semibold text-[13px] text-cc-brand hover:border-cc-brand"
              >
                <Plus size={14} aria-hidden />
                New collection
              </button>
              {collections.map((collection) => (
                <CollectionChip
                  key={collection.id}
                  collection={collection}
                  onOpen={() => openCollection(collection.id)}
                  onRename={(name) => onRename(collection, name)}
                  onDelete={() => setPendingDelete(collection)}
                />
              ))}
            </div>
          ) : collections.length === 0 ? (
            <EmptyPanel
              title="No collections yet"
              body="Create a collection to organize courses you are considering together."
              action={{
                label: "Create collection",
                onClick: () => setDialogOpen(true),
              }}
            />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
              <button
                type="button"
                onClick={() => setDialogOpen(true)}
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

              {collections.map((collection) => (
                <CollectionTile
                  key={collection.id}
                  collection={collection}
                  courseFor={(courseCode) =>
                    savedByCode.get(courseCode)?.course
                  }
                  onOpen={() => openCollection(collection.id)}
                  onRename={(name) => onRename(collection, name)}
                  onDelete={() => setPendingDelete(collection)}
                />
              ))}
            </div>
          )
        ) : null}
      </div>

      <NewCollectionDialog
        open={dialogOpen}
        savedCourses={savedCourses}
        onClose={() => setDialogOpen(false)}
        onCreate={onCreate}
      />

      {/*
        One dialog for all three entry points, rendered by the component that
        owns the mutation rather than by each menu — a tile and a chip both
        unmount the moment the collection goes, and a dialog inside one of them
        would be asking the question from inside the thing being deleted.

        The body names what is lost and what is not: the collection and the
        order its courses were put in, never the courses, which stay saved and
        stay in whatever other collections hold them.
      */}
      <ConfirmDialog
        request={
          pendingDelete
            ? {
                eyebrow: "Collections",
                title: `Delete “${pendingDelete.name}”?`,
                body: "This deletes the collection and the order you put its courses in. The courses themselves stay saved, and stay in any other collection that holds them. A deleted collection cannot be restored.",
                cancelLabel: "Keep collection",
                actionLabel: "Delete collection",
              }
            : null
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={onConfirmDelete}
      />

      {/* Only when nobody else is showing one. An embedded copy would put two
          dialogs over one page, each with its own idea of why. */}
      {onRequestAuth ? null : (
        <AuthReasonDialog
          reason={ownAuthReason}
          onReasonChange={setOwnAuthReason}
          onClose={() => setOwnAuthReason(null)}
        />
      )}
    </>
  );

  // Embedded, the host page owns the column and the `h1`; this is a section
  // inside it, headed the way the artboard heads it.
  if (compact) {
    return (
      <section aria-labelledby={COMPACT_HEADING_ID}>
        <h2
          id={COMPACT_HEADING_ID}
          className="m-0 font-semibold text-[16px] leading-[1.3]"
        >
          Collections
        </h2>
        <div className="mt-1 text-[12.5px] text-cc-muted">{SUBTITLE}</div>
        {body}
      </section>
    );
  }

  return (
    <PageColumn>
      <PageHeader title="Collections" subtitle={SUBTITLE} />
      {body}
    </PageColumn>
  );
}
