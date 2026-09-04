"use client";

import { ArrowLeft, ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AuthReason } from "@/features/auth";
import { courseCountLabel } from "@/features/collections/lib/collection-model";
import {
  type Collection,
  type CourseCardCourse,
  CourseCardItem,
  CourseItemSkeleton,
  EXPANDED_CARD_GEOMETRY,
} from "@/features/courses";
import type { CourseStats } from "@/types";

/** A course the viewer has saved, with everything a card needs to draw it. */
export type SavedCourse = {
  course: CourseCardCourse;
  stats: CourseStats;
};

type Props = {
  collection: Collection;
  /** `undefined` while the course's summary is still in flight. */
  courseFor: (courseCode: string) => SavedCourse | undefined;
  /** Saved courses this collection does not already hold. Saved-only, always. */
  addableCourseCodes: string[];
  /** Whether the viewer has saved anything at all, which changes the empty copy. */
  hasSavedCourses: boolean;
  onBack: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onAddCourse: (courseCode: string) => void;
  onRemoveCourse: (courseCode: string) => void;
  onMoveCourse: (courseCode: string, direction: "up" | "down") => void;
  onOpenCourse: (courseCode: string) => void;
  onRequestAuth: (reason: AuthReason) => void;
};

const ACTION_BUTTON =
  "flex h-8 cursor-pointer items-center rounded-[8px] border border-cc-rule3 bg-cc-surface px-[11px] font-medium text-[12.5px] text-cc-ink hover:border-cc-hov";

const MOVE_BUTTON =
  "flex size-[26px] cursor-pointer items-center justify-center rounded-[7px] border border-cc-rule3 bg-cc-surface text-cc-dim hover:border-cc-hov hover:text-cc-brand disabled:cursor-default disabled:opacity-35 disabled:hover:border-cc-rule3 disabled:hover:text-cc-dim";

/**
 * One open collection: its name, its courses in stored order, and everything
 * that changes either.
 *
 * The courses are `CourseCardItem`s rather than the artboard's one-line rows.
 * The artboard's row shows a code, a title and a `hp · period · school` meta
 * string assembled from its mock store; `period` and `school` are not fields the
 * schema has, and the card renders the same course from data that does exist —
 * so the codebase wins, as #68 has it, and the design's remove affordance
 * survives as the card's own `removeLabel` button, which #86 built for this page.
 * The geometry is pinned to the expanded end: the page column has nothing
 * competing for its width, so there is no ramp to interpolate along.
 *
 * Reordering is a pair of move buttons per course. The artboard designs no
 * reorder control at all, and `collections.reorder` is the only ordering the
 * schema carries, so this is the smallest control that reaches it — and one a
 * keyboard can drive, which a drag handle is not.
 */
export function CollectionDetail({
  collection,
  courseFor,
  addableCourseCodes,
  hasSavedCourses,
  onBack,
  onRename,
  onDelete,
  onAddCourse,
  onRemoveCourse,
  onMoveCourse,
  onOpenCourse,
  onRequestAuth,
}: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const addRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!addOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (!addRef.current?.contains(event.target as Node)) setAddOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", onPointerDown, true);
  }, [addOpen]);

  // The collection under the reader can change: another tab removes a course,
  // or unsaving one cascades its membership away. Nothing addable means nothing
  // to open.
  useEffect(() => {
    if (addableCourseCodes.length === 0) setAddOpen(false);
  }, [addableCourseCodes.length]);

  function commitRename() {
    const name = draft?.trim() ?? "";
    setDraft(null);
    if (name && name !== collection.name) onRename(name);
  }

  const { courseCodes } = collection;

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onBack}
        className="flex cursor-pointer items-center gap-1.5 self-start font-medium text-[12.5px] text-cc-brand hover:underline"
      >
        <ArrowLeft size={14} aria-hidden />
        All collections
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {draft === null ? (
            <h2 className="m-0 font-semibold text-[21px] tracking-[-0.015em]">
              {collection.name}
            </h2>
          ) : (
            <input
              // biome-ignore lint/a11y/noAutofocus: Rename put the caret here, as the artboard's own autoFocus does.
              autoFocus
              aria-label="Collection name"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={commitRename}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
                if (event.key === "Escape") setDraft(null);
              }}
              className="box-border h-[34px] rounded-[8px] border border-cc-brand bg-cc-surface px-2.5 font-semibold text-[20px] text-cc-ink outline-none"
            />
          )}
          <div className="mt-[5px] text-[12.5px] text-cc-muted">
            {courseCountLabel(courseCodes.length)}
          </div>
        </div>

        <div className="flex items-center gap-[7px]">
          <button
            type="button"
            onClick={() => setDraft(collection.name)}
            className={ACTION_BUTTON}
          >
            Rename
          </button>

          {addableCourseCodes.length > 0 ? (
            <div className="relative" ref={addRef}>
              <button
                type="button"
                onClick={() => setAddOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={addOpen}
                className={ACTION_BUTTON}
              >
                Add course
              </button>
              {addOpen ? (
                <div
                  role="menu"
                  aria-label="Add a saved course"
                  className="absolute top-9 right-0 z-20 box-border max-h-[260px] w-[250px] overflow-auto rounded-[10px] border border-cc-rule2 bg-cc-surface p-[5px] shadow-[0_8px_24px_rgba(20,30,45,.14)]"
                >
                  {addableCourseCodes.map((courseCode) => (
                    <button
                      key={courseCode}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAddOpen(false);
                        onAddCourse(courseCode);
                      }}
                      className="flex w-full cursor-pointer items-baseline gap-2 rounded-[7px] px-[9px] py-2 text-left text-[12.5px] text-cc-ink2 hover:bg-cc-pill"
                    >
                      <span className="font-mono text-[11.5px] text-cc-dim">
                        {courseCode}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {courseFor(courseCode)?.course.titleEng ?? ""}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <button
            type="button"
            onClick={onDelete}
            className="flex h-8 cursor-pointer items-center rounded-[8px] border border-cc-danger/35 bg-cc-surface px-[11px] font-medium text-[12.5px] text-cc-danger hover:border-cc-danger/60"
          >
            Delete
          </button>
        </div>
      </div>

      {courseCodes.length === 0 ? (
        <div className="rounded-[11px] border border-cc-rule bg-cc-surface p-6 text-center">
          <div className="font-semibold text-[14.5px]">
            No courses in this collection
          </div>
          <div className="mt-[5px] text-[12.5px] text-cc-muted">
            {hasSavedCourses
              ? "Add one of your saved courses to it — a collection can only hold courses you have saved."
              : "A collection can only hold courses you have saved. Save some from Explore, then add them here."}
          </div>
        </div>
      ) : (
        <ol className="flex list-none flex-col gap-3 p-0">
          {courseCodes.map((courseCode, index) => {
            const saved = courseFor(courseCode);
            return (
              <li key={courseCode} className="flex items-center gap-2.5">
                <div className="flex flex-none flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => onMoveCourse(courseCode, "up")}
                    disabled={index === 0}
                    aria-label={`Move ${courseCode} up`}
                    className={MOVE_BUTTON}
                  >
                    <ChevronUp size={15} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => onMoveCourse(courseCode, "down")}
                    disabled={index === courseCodes.length - 1}
                    aria-label={`Move ${courseCode} down`}
                    className={MOVE_BUTTON}
                  >
                    <ChevronDown size={15} aria-hidden />
                  </button>
                </div>

                <div className="min-w-0 flex-1">
                  {saved ? (
                    <CourseCardItem
                      course={saved.course}
                      stats={saved.stats}
                      geo={EXPANDED_CARD_GEOMETRY}
                      action="add"
                      removeLabel={`Remove ${courseCode} from ${collection.name}`}
                      onRemove={() => onRemoveCourse(courseCode)}
                      onOpen={() => onOpenCourse(courseCode)}
                      onRequestAuth={onRequestAuth}
                    />
                  ) : (
                    <CourseItemSkeleton />
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
