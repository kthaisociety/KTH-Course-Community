"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { AuthReason } from "@/features/auth";
import { useMe } from "@/features/auth";
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
import { useResultsWidth } from "@/features/workspace";
import type { CardGeometry } from "@/types";
import type { SavedCourse } from "../components/collection-detail";

/** How long the artboard's confirmation strip stays up, in milliseconds. */
export const NOTE_LIFETIME = 3000;

export interface UseCollectionsStateOptions {
  /**
   * The collection named by `?collection=` on the route, if any.
   *
   * Deep links are why the not-found state is reachable at all. Another user's
   * collection is absent from `collections.list` — ownership is scoped in the
   * query, so the server never learns whether a stranger's id exists — and the
   * body says the same thing the server does: not found, never "not yours".
   */
  openCollectionId?: string | null;
  /**
   * The host page's sign-in surface. Passed when the parts are embedded,
   * because two `AuthReasonDialog`s in one tree are two dialogs racing for one
   * screen; the body renders its own when this is absent.
   */
  onRequestAuth?: (reason: AuthReason) => void;
  /**
   * The card collapse ramp for an open collection's courses, when the host has
   * already measured the column they land in.
   *
   * `/saved` puts the body inside the very column `WorkspacePaneHost` narrows,
   * so the geometry it computes for its own list is the geometry these cards
   * need too, or one card behaves two ways on one page. Left out, this measures
   * the column the body is standing in, which is what `/collections` does.
   */
  geo?: CardGeometry;
}

/**
 * Everything the collections strip and the collections body share.
 *
 * ## Why this is a hook and not a component rendered twice
 *
 * Since #208 the chips and the detail live in **different parts of the page**:
 * on `/saved` the chips are the narrow band above the workspace row, and the
 * detail is inside the scrolling results column. They cannot be one instance,
 * because they are not in one subtree — and they cannot be two instances of the
 * old `Collections`, because that component owns `?collection=` and calls
 * `router.replace`. Two of those would be two writers on one URL, which is the
 * render-loop class of bug this repo has been bitten by more than once.
 *
 * So the state lifts here and the two parts become presentational. One hook
 * call per page means one router writer per page, no context, no portals, and
 * no duplicated mutation logic. Saved reads `openId` off the return rather than
 * being told about it through a callback, which is why `onDetailChange` is
 * gone.
 *
 * ## What each page does with it
 *
 * - `/saved` calls it once and renders **both** parts: the strip in the band,
 *   the body in the column.
 * - `/collections` calls it and renders the **body** only. That route has no
 *   chip strip and never did — `compact` used to pick between two presentations
 *   of the same list, chips for Saved and 150px tiles for the page, and the
 *   tiles are part of the body.
 */
export function useCollectionsState({
  openCollectionId = null,
  onRequestAuth,
  geo,
}: UseCollectionsStateOptions = {}) {
  const router = useRouter();
  // The route this is rendered on owns `?collection=`, so an open detail is
  // shareable and survives a refresh on the page it was opened from rather than
  // sending the reader to `/collections`.
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
      router.replace(
        collectionId
          ? `${pathname}?collection=${encodeURIComponent(collectionId)}`
          : pathname,
        { scroll: false },
      );
    },
    [router, pathname],
  );

  // Every course the parts can show is a saved course: a collection cannot hold
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

  return {
    /** The viewer's collections, or `undefined` before the query has landed. */
    collections,
    signedIn,
    isLoading,
    /** Which collection is open. Saved reads this instead of being told. */
    openId,
    openCollectionRecord,
    openCollection,
    /** The column the body measures for itself when no host supplies a ramp. */
    columnRef,
    cardGeo,
    savedByCode,
    savedCourses,
    savedCourseCodes,
    /** The codes an open collection can still take, ready for its picker. */
    addableFor: (collection: Collection) =>
      addableCourseCodes(savedCourseCodes, collection.courseCodes),
    note,
    dialogOpen,
    openDialog: () => setDialogOpen(true),
    closeDialog: () => setDialogOpen(false),
    pendingDelete,
    requestDelete: setPendingDelete,
    cancelDelete: () => setPendingDelete(null),
    onConfirmDelete,
    onCreate,
    onRename,
    onAddCourse,
    onRemoveCourse,
    onMoveCourse,
    setAuthReason,
    /** True when nobody else is showing a sign-in dialog, so the body must. */
    ownsAuthDialog: onRequestAuth === undefined,
    ownAuthReason,
    setOwnAuthReason,
  };
}

export type CollectionsState = ReturnType<typeof useCollectionsState>;
