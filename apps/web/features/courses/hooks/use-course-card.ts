"use client";

import { useState } from "react";
import { toast } from "sonner";
import { type AuthReason, useMe } from "@/features/auth";
import { useMarkCourseTaken } from "@/features/courses/api/mutations";
import { useTakenCourses } from "@/features/courses/api/queries";
import { useCollectionPicker } from "@/features/courses/hooks/use-collection-picker";
import {
  type CourseCardCourse,
  type CourseCardView,
  toCourseCardModel,
} from "@/features/courses/lib/course-card-model";
import { useSetCourseSaved } from "@/features/favorites";
import type {
  CourseCardAction,
  CourseCardModel,
  CourseStats,
  PrerequisiteCourse,
} from "@/types";

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
  const markTaken = useMarkCourseTaken();

  const [takenPickerOpen, setTakenPickerOpen] = useState(false);

  const isSaved = user?.savedCourseCodes.includes(courseCode) ?? false;
  const isTaken =
    takenCourses?.some((taken) => taken.courseCode === courseCode) ?? false;

  // Putting a course in a collection is two writes that can fail apart, and the
  // panel carries its own open/draft state; that whole concern lives in its own
  // hook rather than in among the card's two single-call controls.
  const picker = useCollectionPicker({
    courseCode,
    isSaved,
    signedIn,
    setSaved,
  });

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
      // The two panels are mutually exclusive: one card, one popover.
      picker.close();
      setTakenPickerOpen((open) => !open);
      return;
    }
    markTaken
      .mutateAsync({ courseCode })
      .catch(() => toast.error(`Could not mark ${courseCode} as taken.`));
  }

  function onPicker() {
    setTakenPickerOpen(false);
    picker.toggle();
  }

  const view: CourseCardView = {
    course,
    stats,
    isSaved,
    isTaken,
    prerequisites,
    collections: picker.rows,
    isActive,
    pickerOpen: picker.isOpen,
    creating: picker.creating,
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
      onNewCollection: picker.startNew,
      onSignUp: () => onRequestAuth("sign-up"),
      onLogIn: () => onRequestAuth("log-in"),
    },
    action,
    signedIn,
    draftName: picker.draftName,
    onDraftChange: picker.onDraftChange,
    onDraftCommit: picker.onDraftCommit,
    onDraftCancel: picker.onDraftCancel,
  };
}
