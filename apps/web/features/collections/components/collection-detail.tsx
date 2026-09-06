"use client";

import { ArrowLeft, ChevronDown, ChevronUp } from "lucide-react";
import { useEffect } from "react";
import type { AuthReason } from "@/features/auth";
import { usePopover } from "@/features/collections/hooks/use-popover";
import { useRenameDraft } from "@/features/collections/hooks/use-rename-draft";
import { courseCountLabel } from "@/features/collections/lib/collection-model";
import {
  type Collection,
  type CourseCardCourse,
  CourseCardItem,
} from "@/features/courses";
import type { CardGeometry, CourseStats } from "@/types";
import { EmptyPanel } from "./empty-panel";

/** A course the viewer has saved, with everything a card needs to draw it. */
export type SavedCourse = {
  course: CourseCardCourse;
  stats: CourseStats;
};

type Props = {
  collection: Collection;
  /**
   * The card's collapse ramp, measured by whoever owns the column these rows
   * are laid out in.
   *
   * This used to be `EXPANDED_CARD_GEOMETRY`, pinned here on the grounds that
   * the page column had nothing competing for its width. That was true of
   * `/collections` and false of `/saved`, which embeds this component inside the
   * very column the workspace pane narrows — so one card collapsed or did not
   * depending only on which of the page's two lists it was in, and the surplus
   * was clipped rather than scrolled because that column is `overflow-x-hidden`
   * (#159). The decision belongs to the host, and both hosts now measure.
   *
   * It is the *column's* width, not the card's: each row spends 36px on the
   * reorder buttons before the card starts, so the ramp here runs about 36px
   * ahead of the card's true width. That shifts where the collapse begins by a
   * fifth of the ramp; it never leaves the ramp, and closing it would mean a
   * second measurement per row for a card that is already interpolating.
   */
  geo: CardGeometry;
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
  /** Starts a review from a course card in this collection. */
  onReviewCourse: (courseCode: string) => void;
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
 * The geometry arrives as a prop; see {@link Props.geo} for why this component
 * is the wrong place to decide it.
 *
 * Reordering is a pair of move buttons per course. The artboard designs no
 * reorder control at all, and `collections.reorder` is the only ordering the
 * schema carries, so this is the smallest control that reaches it — and one a
 * keyboard can drive, which a drag handle is not.
 */
export function CollectionDetail({
  collection,
  geo,
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
  onReviewCourse,
  onRequestAuth,
}: Props) {
  const renaming = useRenameDraft(collection.name, onRename);
  const addMenu = usePopover();

  // The collection under the reader can change: another tab removes a course,
  // or unsaving one cascades its membership away. Nothing addable means nothing
  // to open, and the trigger itself goes with it.
  const nothingAddable = addableCourseCodes.length === 0;
  const closeAddMenu = addMenu.close;
  useEffect(() => {
    if (nothingAddable) closeAddMenu();
  }, [nothingAddable, closeAddMenu]);

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
          {renaming.isRenaming ? (
            <input
              // biome-ignore lint/a11y/noAutofocus: Rename put the caret here, as the artboard's own autoFocus does.
              autoFocus
              aria-label="Collection name"
              value={renaming.draft}
              onChange={(event) => renaming.change(event.target.value)}
              onBlur={renaming.commit}
              onKeyDown={renaming.onKeyDown}
              className="box-border h-[34px] rounded-[8px] border border-cc-brand bg-cc-surface px-2.5 font-semibold text-[20px] text-cc-ink outline-none"
            />
          ) : (
            <h2 className="m-0 font-semibold text-[21px] tracking-[-0.015em]">
              {collection.name}
            </h2>
          )}
          <div className="mt-[5px] text-[12.5px] text-cc-muted">
            {courseCountLabel(courseCodes.length)}
          </div>
        </div>

        <div className="flex items-center gap-[7px]">
          <button
            type="button"
            onClick={renaming.start}
            className={ACTION_BUTTON}
          >
            Rename
          </button>

          {nothingAddable ? null : (
            <div className="relative">
              <button
                ref={addMenu.triggerRef}
                type="button"
                onClick={addMenu.toggle}
                aria-haspopup="menu"
                aria-expanded={addMenu.isOpen}
                className={ACTION_BUTTON}
              >
                Add course
              </button>
              {addMenu.isOpen ? (
                <div
                  ref={addMenu.panelRef}
                  role="menu"
                  aria-label="Add a saved course"
                  className="scrollbar-subtle absolute top-9 right-0 z-20 box-border max-h-[260px] w-[250px] overflow-auto rounded-[10px] border border-cc-rule2 bg-cc-surface p-[5px] shadow-[0_8px_24px_rgba(20,30,45,.14)]"
                >
                  {addableCourseCodes.map((courseCode) => (
                    <button
                      key={courseCode}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        addMenu.close();
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
          )}

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
        <EmptyPanel
          title="No courses in this collection"
          body={
            hasSavedCourses
              ? "Add one of your saved courses to it — a collection can only hold courses you have saved."
              : "A collection can only hold courses you have saved. Save some from Explore, then add them here."
          }
        />
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
                      geo={geo}
                      action="add"
                      removeLabel={`Remove ${courseCode} from ${collection.name}`}
                      onRemove={() => onRemoveCourse(courseCode)}
                      onOpen={() => onOpenCourse(courseCode)}
                      onReview={() => onReviewCourse(courseCode)}
                      onRequestAuth={onRequestAuth}
                    />
                  ) : (
                    // A course card that has not arrived yet, in the shape
                    // Saved already uses for the same card.
                    <div className="h-[236px] animate-pulse rounded-[11px] border border-cc-rule bg-cc-surface" />
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
