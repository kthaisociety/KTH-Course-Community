"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { useCollectionMutations } from "@/features/courses/api/mutations";
import { useCollections } from "@/features/courses/api/queries";
import type { CollectionPickerRow } from "@/types";

/**
 * The course card's collection picker: which collections hold this course, and
 * every write that changes that.
 *
 * It is its own hook because putting a course in a collection is not one write.
 * A course may only join a collection its owner has also saved, so the picker
 * has to save first — and then two writes can fail independently, in ways that
 * need different words and different recovery advice. That consistency problem
 * belongs together, and it belongs away from the card's save and taken
 * controls, which are each a single idempotent call.
 *
 * The open/closed and draft state is local to one course, which is why a list
 * can have many cards without a screen tracking which picker is open.
 */

/** The tick the picker draws on a collection that already holds the course. */
const PICKER_TICK = "m8.5 12 2.4 2.4 4.6-4.9";

/**
 * A picker write that failed, carrying which of its steps did.
 *
 * The recovery advice differs by step: a failed *add* can be retried from the
 * collection's row, but a failed *save* blocks that row too, so pointing at it
 * would be sending the reader somewhere that cannot succeed. The message is
 * written where the failure happens; `step` is what lets a caller add context
 * without replacing it.
 */
export class CollectionWriteError extends Error {
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

type Options = {
  courseCode: string;
  /** Whether the viewer has saved this course; a collection requires it. */
  isSaved: boolean;
  /** Gates the protected query: a visitor is shown the sign-up prompt instead. */
  signedIn: boolean;
  /** From `useSetCourseSaved`, so the picker and the Save button share one path. */
  setSaved: (courseCode: string, saved: boolean) => Promise<void>;
};

export type CollectionPicker = {
  rows: CollectionPickerRow[];
  isOpen: boolean;
  creating: boolean;
  draftName: string;
  /** Opens or closes the panel, abandoning any half-typed name. */
  toggle: () => void;
  close: () => void;
  /** Swaps the "Create new collection" row for the name field. */
  startNew: () => void;
  onDraftChange: (name: string) => void;
  onDraftCommit: () => void;
  onDraftCancel: () => void;
};

export function useCollectionPicker({
  courseCode,
  isSaved,
  signedIn,
  setSaved,
}: Options): CollectionPicker {
  const { data: collections } = useCollections(signedIn);
  const { create, addCourse, removeCourse } = useCollectionMutations();

  const [isOpen, setIsOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState("");

  /**
   * Saves the course when it is not saved yet, then adds it.
   *
   * Each step throws a message naming itself, so a caller never blames one for
   * the other. A save that succeeded before a failed add is said out loud
   * rather than left as a Save button that appears to have flipped on its own.
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

  const rows: CollectionPickerRow[] = useMemo(
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

  /** Abandons the draft: the name typed into a picker that is being closed. */
  const clearDraft = useCallback(() => {
    setCreating(false);
    setDraftName("");
  }, []);

  /**
   * Creates a collection and puts the course in it — two writes, reported
   * apart.
   *
   * If a later step fails, saying "could not create" would send the reader back
   * to the name field, and typing the same name again makes a *second* empty
   * collection: `collections.create` has no uniqueness on name. So the failure
   * says the collection was made, and then says which step actually failed,
   * because that decides whether the recovery on screen can even work.
   */
  const onDraftCommit = useCallback(async () => {
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
  }, [addToCollection, clearDraft, courseCode, create, draftName]);

  return {
    rows,
    isOpen,
    creating,
    draftName,
    toggle: () => {
      setIsOpen((open) => !open);
      // Both the name and the row it belongs to go, so reopening the picker
      // does not offer a half-typed name from the last time it was open.
      clearDraft();
    },
    close: () => {
      setIsOpen(false);
      clearDraft();
    },
    startNew: () => setCreating(true),
    onDraftChange: setDraftName,
    onDraftCommit,
    onDraftCancel: clearDraft,
  };
}
