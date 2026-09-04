"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { type AuthReason, useMe } from "@/features/auth";
import {
  useCollectionMutations,
  useMarkCourseTaken,
} from "@/features/courses/api/mutations";
import {
  useCollections,
  useTakenCourses,
} from "@/features/courses/api/queries";
import {
  type CourseCardCourse,
  type CourseCardView,
  toCourseCardModel,
} from "@/features/courses/lib/course-card-model";
import { useSetCourseSaved } from "@/features/favorites";
import type {
  CollectionPickerRow,
  CourseCardAction,
  CourseCardModel,
  CourseStats,
  PrerequisiteCourse,
} from "@/types";

/** The checkbox tick the picker draws for a collection the course is already in. */
const PICKER_TICK = "m8.5 12 2.4 2.4 4.6-4.9";

/**
 * A picker write that failed, carrying which of its steps did.
 *
 * Putting a course in a collection is up to two writes, and the caller's
 * recovery advice differs by which one failed: an add that failed can be
 * retried from the collection's row, but a *save* that failed blocks that row
 * too, because a course may only join a collection its owner has saved. The
 * message is written where the failure happens; `step` is what lets a caller
 * add context without replacing it.
 */
class CollectionWriteError extends Error {
  constructor(
    readonly step: "save" | "add" | "remove",
    message: string,
  ) {
    super(message);
    this.name = "CollectionWriteError";
  }
}

/** Surfaces a failed write in the words of the step that actually failed. */
function reportWriteFailure(error: unknown) {
  toast.error(
    error instanceof Error ? error.message : "That did not go through.",
  );
}

export type UseCourseCardOptions = {
  course: CourseCardCourse;
  /** From `course.stats`, batched for the whole page. `reviews: null` is absent. */
  stats: CourseStats;
  action?: CourseCardAction;
  /** `null` — the only value today — means nobody ever extracted them. */
  prerequisites?: PrerequisiteCourse[] | null;
  /** Explore rings the card whose workspace pane is open. */
  isActive?: boolean;
  /** Names and enables the remove button. Saved and Collections pass one. */
  removeLabel?: string;
  onOpen?: () => void;
  onReview?: () => void;
  onRemove?: () => void;
  /**
   * Opens the app's one sign-in surface. The card's inline prompts name the
   * reason; `AuthReasonDialog` does the signing in, and the screen renders a
   * single one for its whole list.
   */
  onRequestAuth: (reason: AuthReason) => void;
};

/** Exactly the props `CourseCard` needs beyond `geo`. */
export type CourseCardProps = {
  c: CourseCardModel;
  action: CourseCardAction;
  signedIn: boolean;
  draftName: string;
  onDraftChange: (name: string) => void;
  onDraftCommit: () => void;
  onDraftCancel: () => void;
};

/**
 * Binds one course card to the real procedures.
 *
 * Everything that decides what the card *says* is in `toCourseCardModel`, which
 * is pure; everything that decides what a click *does* is here. The card itself
 * does neither.
 *
 * **Call this from a component that renders exactly one card, keyed by course
 * code — never from a `courses.map(...)` callback in the screen.** It holds
 * several hooks, so a parent that calls it once per list item binds that state
 * to a list *position*: reorder the list and the open picker moves to another
 * course, shorten it and React throws "Rendered fewer hooks than expected".
 * `CourseCardItem` is that component, and it is what the barrel exports —
 * screens should render it rather than reach for this hook.
 *
 * The picker's open/closed and draft state is local to one card, which is why a
 * list can have many cards without a screen tracking which one is open.
 */
export function useCourseCard({
  course,
  stats,
  action = "save",
  prerequisites = null,
  isActive,
  removeLabel,
  onOpen,
  onReview,
  onRemove,
  onRequestAuth,
}: UseCourseCardOptions): CourseCardProps {
  const { user } = useMe();
  const signedIn = user !== null;
  const courseCode = course.courseCode;

  const { setSaved } = useSetCourseSaved();
  const { data: takenCourses } = useTakenCourses(signedIn);
  const { data: collections } = useCollections(signedIn);
  const { create, addCourse, removeCourse } = useCollectionMutations();
  const markTaken = useMarkCourseTaken();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [takenPickerOpen, setTakenPickerOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState("");

  const isSaved = user?.savedCourseCodes.includes(courseCode) ?? false;
  const isTaken =
    takenCourses?.some((taken) => taken.courseCode === courseCode) ?? false;

  /**
   * A course may only join a collection its owner has also saved — the service
   * rejects it otherwise, and the composite foreign key would too. The artboard
   * treats the picker as independent of Save, so the minimal fit is for the
   * picker to save first rather than to fail or to hide itself.
   *
   * These are two writes and either can fail on its own, so each throws a
   * message naming the step that actually failed. A save that succeeded before
   * a failed add is said out loud rather than left as a Save button that
   * silently flipped.
   */
  const addToCollection = useCallback(
    async (collectionId: string, collectionName: string) => {
      if (!isSaved) {
        try {
          await setSaved(courseCode, true);
        } catch {
          throw new CollectionWriteError(
            "save",
            `Could not save ${courseCode}, so it was not added to "${collectionName}".`,
          );
        }
      }
      try {
        await addCourse.mutateAsync({ collectionId, courseCode });
      } catch {
        throw new CollectionWriteError(
          "add",
          isSaved
            ? `Could not add ${courseCode} to "${collectionName}".`
            : `Saved ${courseCode}, but could not add it to "${collectionName}".`,
        );
      }
    },
    [addCourse, courseCode, isSaved, setSaved],
  );

  const pickerRows: CollectionPickerRow[] = useMemo(
    () =>
      (collections ?? []).map((collection) => {
        const holdsCourse = collection.courseCodes.includes(courseCode);
        return {
          id: collection.id,
          name: collection.name,
          fill: holdsCourse ? "currentColor" : "none",
          tick: holdsCourse ? PICKER_TICK : "",
          onClick: () => {
            const write = holdsCourse
              ? removeCourse
                  .mutateAsync({ collectionId: collection.id, courseCode })
                  .catch(() => {
                    throw new CollectionWriteError(
                      "remove",
                      `Could not remove ${courseCode} from "${collection.name}".`,
                    );
                  })
              : addToCollection(collection.id, collection.name);
            write.catch(reportWriteFailure);
          },
        };
      }),
    [addToCollection, collections, courseCode, removeCourse],
  );

  function onSave() {
    if (!signedIn) {
      onRequestAuth("save-course");
      return;
    }
    setSaved(courseCode, !isSaved).catch(() =>
      toast.error(`Could not ${isSaved ? "unsave" : "save"} ${courseCode}.`),
    );
  }

  function onTaken() {
    if (!signedIn) {
      setPickerOpen(false);
      setTakenPickerOpen((open) => !open);
      return;
    }
    markTaken
      .mutateAsync({ courseCode })
      .catch(() => toast.error(`Could not mark ${courseCode} as taken.`));
  }

  /** Abandons the draft: the name typed into a picker that is being closed. */
  function clearDraft() {
    setCreating(false);
    setDraftName("");
  }

  function onPicker() {
    setTakenPickerOpen(false);
    setPickerOpen((open) => !open);
    // Both the name and the row it belongs to go, so reopening the picker does
    // not offer a half-typed name from the last time it was open.
    clearDraft();
  }

  /**
   * Creates a collection and puts the course in it — two writes, reported
   * apart.
   *
   * If a later step fails, saying "could not create" would send the reader back
   * to the name field, and typing the same name again makes a *second* empty
   * collection: `collections.create` has no uniqueness on name. So the failure
   * says the collection was made, and then says which step actually failed —
   * which decides whether the recovery on screen can even work. A failed *add*
   * retries from the collection's row. A failed *save* blocks that row too,
   * because a course may only join a collection its owner has saved, so
   * pointing at it would be sending the reader somewhere that cannot succeed.
   */
  async function onDraftCommit() {
    const name = draftName.trim();
    clearDraft();
    if (!name) return;

    let collection: { id: string };
    try {
      collection = await create.mutateAsync({ name });
    } catch {
      toast.error(`Could not create the collection "${name}".`);
      return;
    }

    try {
      await addToCollection(collection.id, name);
    } catch (error) {
      const failedToSave =
        error instanceof CollectionWriteError && error.step === "save";
      toast.error(
        failedToSave
          ? `Created "${name}", but could not save ${courseCode}, so it is not in the collection yet. Save the course, then pick "${name}" from the list.`
          : `Created "${name}", but could not add ${courseCode} to it. Pick it from the list to try again.`,
      );
    }
  }

  const view: CourseCardView = {
    course,
    stats,
    isSaved,
    isTaken,
    prerequisites,
    collections: pickerRows,
    isActive,
    pickerOpen,
    creating,
    takenPickerOpen,
    removeLabel: onRemove ? (removeLabel ?? `Remove ${courseCode}`) : undefined,
  };

  return {
    c: {
      ...toCourseCardModel(view),
      onOpen,
      onReview,
      onRemove,
      onSave,
      // Once a course is marked taken the pill stops being a control: unmarking
      // would delete the self-reported grade, credits and periods stored beside
      // it, and that belongs on Taken courses where those values are visible.
      onTaken: signedIn && isTaken ? undefined : onTaken,
      onPicker,
      onNewCollection: () => setCreating(true),
      onSignUp: () => onRequestAuth("sign-up"),
      onLogIn: () => onRequestAuth("log-in"),
    },
    action,
    signedIn,
    draftName,
    onDraftChange: setDraftName,
    onDraftCommit,
    onDraftCancel: clearDraft,
  };
}
