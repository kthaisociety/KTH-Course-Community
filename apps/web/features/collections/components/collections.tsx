"use client";

import { Check, Lock, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { type AuthReason, AuthReasonDialog, useMe } from "@/features/auth";
import {
  addableCourseCodes,
  moveCourse,
} from "@/features/collections/lib/collection-model";
import {
  type Collection,
  CourseItemSkeleton,
  useCollectionMutations,
  useCollections,
  useCourseSummaries,
} from "@/features/courses";
import { PageColumn, PageHeader } from "@/features/shell";
import { CollectionDetail, type SavedCourse } from "./collection-detail";
import { CollectionTile } from "./collection-tile";
import { NewCollectionDialog } from "./new-collection-dialog";

/** How long the artboard's confirmation strip stays up, in milliseconds. */
const NOTE_LIFETIME = 4000;

const SKELETON_KEYS = ["c0", "c1", "c2"] as const;

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
 * to build (#90); this is the same component as a page of its own, so the
 * feature is reachable and usable before Saved exists. The `compact` chip
 * variant is deliberately not built — it has no caller yet, and building an
 * untested second layout for one is worse than leaving it to whoever embeds it.
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
 */
export function Collections({ openCollectionId = null }: Props) {
  const router = useRouter();
  const { user, isLoading: sessionLoading } = useMe();
  const signedIn = user !== null;
  const savedCourseCodes = user?.savedCourseCodes ?? [];

  const { data: collections, isPending: collectionsPending } =
    useCollections(signedIn);
  const summaries = useCourseSummaries(savedCourseCodes, signedIn);
  const { create, rename, deleteCollection, reorder, addCourse, removeCourse } =
    useCollectionMutations();

  const [openId, setOpenId] = useState<string | null>(openCollectionId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [note, setNote] = useState<{ key: number; text: string } | null>(null);
  const [authReason, setAuthReason] = useState<AuthReason | null>(null);

  const showNote = useCallback(
    (text: string) => setNote({ key: Date.now(), text }),
    [],
  );

  useEffect(() => {
    if (!note) return;
    const timer = setTimeout(() => setNote(null), NOTE_LIFETIME);
    return () => clearTimeout(timer);
  }, [note]);

  /** Keeps the route in step with what is open, so a refresh lands back here. */
  const openCollection = useCallback(
    (collectionId: string | null) => {
      setOpenId(collectionId);
      router.replace(
        collectionId
          ? `/collections?collection=${encodeURIComponent(collectionId)}`
          : "/collections",
        { scroll: false },
      );
    },
    [router],
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
  const savedCourses = savedCourseCodes.flatMap(
    (courseCode) => savedByCode.get(courseCode)?.course ?? [],
  );

  const openCollectionRecord =
    collections?.find((collection) => collection.id === openId) ?? null;

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

  function onDelete(collection: Collection) {
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

  const isLoading = sessionLoading || (signedIn && collectionsPending);

  return (
    <PageColumn>
      <PageHeader
        title="Collections"
        subtitle="Group courses you want to compare."
      />

      <div className="flex flex-col gap-3.5 px-7 pt-[18px]">
        {note ? (
          <div
            aria-live="polite"
            className="flex items-center gap-2 rounded-[9px] border border-cc-rule2 bg-cc-pill px-[13px] py-[9px] text-[12.5px] text-cc-brand"
          >
            <Check size={14} aria-hidden />
            {note.text}
          </div>
        ) : null}

        {isLoading ? (
          <ul className="flex list-none flex-col gap-3 p-0">
            {SKELETON_KEYS.map((key) => (
              <li key={key}>
                <CourseItemSkeleton />
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
          <div className="rounded-[11px] border border-cc-rule bg-cc-surface p-6 text-center">
            <div className="font-semibold text-[14.5px]">
              Collection not found
            </div>
            <div className="mt-[5px] text-[12.5px] text-cc-muted">
              There is no such collection. It may have been deleted.
            </div>
            <button
              type="button"
              onClick={() => openCollection(null)}
              className="mx-auto mt-[13px] flex h-[34px] w-max cursor-pointer items-center rounded-[9px] bg-cc-btn px-3.5 font-semibold text-[13px] text-cc-btn-fg hover:opacity-[0.88]"
            >
              All collections
            </button>
          </div>
        ) : null}

        {!isLoading && signedIn && openCollectionRecord ? (
          <CollectionDetail
            collection={openCollectionRecord}
            courseFor={(courseCode) => savedByCode.get(courseCode)}
            addableCourseCodes={addableCourseCodes(
              savedCourseCodes,
              openCollectionRecord.courseCodes,
            )}
            hasSavedCourses={savedCourseCodes.length > 0}
            onBack={() => openCollection(null)}
            onRename={(name) => onRename(openCollectionRecord, name)}
            onDelete={() => onDelete(openCollectionRecord)}
            onAddCourse={(courseCode) =>
              onAddCourse(openCollectionRecord, courseCode)
            }
            onRemoveCourse={(courseCode) =>
              onRemoveCourse(openCollectionRecord, courseCode)
            }
            onMoveCourse={(courseCode, direction) =>
              onMoveCourse(openCollectionRecord, courseCode, direction)
            }
            onOpenCourse={(courseCode) =>
              router.push(`/course/${courseCode}?from=collections`)
            }
            onRequestAuth={setAuthReason}
          />
        ) : null}

        {!isLoading && signedIn && openId === null && collections ? (
          collections.length === 0 ? (
            <div className="rounded-[11px] border border-cc-rule bg-cc-surface p-6 text-center">
              <div className="font-semibold text-[14.5px]">
                No collections yet
              </div>
              <div className="mt-[5px] text-[12.5px] text-cc-muted">
                Create a collection to organize courses you are considering
                together.
              </div>
              <button
                type="button"
                onClick={() => setDialogOpen(true)}
                className="mx-auto mt-[13px] flex h-[34px] w-max cursor-pointer items-center rounded-[9px] bg-cc-btn px-3.5 font-semibold text-[13px] text-cc-btn-fg hover:opacity-[0.88]"
              >
                Create collection
              </button>
            </div>
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
                  onDelete={() => onDelete(collection)}
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

      <AuthReasonDialog
        reason={authReason}
        onReasonChange={setAuthReason}
        onClose={() => setAuthReason(null)}
      />
    </PageColumn>
  );
}
