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
 * This is the seam the pages sit on: a screen fetches its courses and their
 * stats, calls this per card, and spreads the result. Everything that decides
 * what the card *says* is in `toCourseCardModel`, which is pure; everything that
 * decides what a click *does* is here. The card itself does neither.
 *
 * The picker's open/closed and draft state is local to one card, so a list can
 * have many cards without a screen tracking which one is open.
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
   */
  const addToCollection = useCallback(
    async (collectionId: string) => {
      if (!isSaved) await setSaved(courseCode, true);
      await addCourse.mutateAsync({ collectionId, courseCode });
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
              ? removeCourse.mutateAsync({
                  collectionId: collection.id,
                  courseCode,
                })
              : addToCollection(collection.id);
            write.catch(() =>
              toast.error(
                holdsCourse
                  ? `Could not remove ${courseCode} from ${collection.name}.`
                  : `Could not add ${courseCode} to ${collection.name}.`,
              ),
            );
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

  function onDraftCommit() {
    const name = draftName.trim();
    clearDraft();
    if (!name) return;
    create
      .mutateAsync({ name })
      .then((collection) => addToCollection(collection.id))
      .catch(() => toast.error(`Could not create the collection "${name}".`));
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
