"use client";

import { useEffect, useRef, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  type OpenCourse,
  type OpenCourseKind,
  openCourseLabel,
  tabLabel,
  tabLayout,
} from "../lib/open-courses";
import { EMPTY_REVIEW_DRAFT, type ReviewDraft } from "../lib/review-draft";
import {
  readDrafts,
  readPublished,
  writeDrafts,
  writePublished,
} from "../lib/workspace-storage";
import { CourseDetailsPanel } from "./course-details-panel";
import { ReviewDraftPanel } from "./review-draft-panel";

/**
 * The tab colour for each kind: brand blue for a course being read, the warn
 * amber the whole review surface uses for one being written.
 */
const KIND_ACCENT: Record<OpenCourseKind, string> = {
  details: "var(--cc-brand)",
  review: "var(--cc-warn-ink)",
};

export interface WorkspacePaneProps {
  /** Every course open in the pane, in tab order. */
  openCourses: OpenCourse[];
  activeId: string | null;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  /** Opening a review draft from the course being read, and vice versa. */
  onOpen: (courseCode: string, kind: OpenCourseKind) => void;
  /**
   * Drop the tab strip. The mobile layout shows the pane as a full-screen
   * sheet with one course in it, and puts the switcher in its own chrome.
   */
  hideTabs?: boolean;
  className?: string;
}

/**
 * The workspace pane: the column beside Explore's results in which a user
 * keeps several courses open at once.
 *
 * Each open course is a tab, and a tab is either the course's **details** or a
 * **review draft** for it — so a student can read three courses and write a
 * review without losing the search behind them. Nothing here is persisted;
 * closing the last tab is the whole of "closing the pane".
 *
 * The open list belongs to the host screen (`useWorkspacePane`), which needs
 * it to size its results column. Drafts belong here, keyed by course, so
 * switching tabs never loses half-written text.
 */
export function WorkspacePane({
  openCourses,
  activeId,
  onActivate,
  onClose,
  onOpen,
  hideTabs = false,
  className,
}: Readonly<WorkspacePaneProps>) {
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({});
  const [published, setPublished] = useState<Record<string, number>>({});
  const restored = useRef(false);

  // Drafts, and what has already been published, outlive the tab they were
  // written in: signing in navigates the page away and back, and a review tab
  // is a thing you come back to. Restored in an effect so the first client
  // render matches the server's.
  useEffect(() => {
    setDrafts(readDrafts());
    setPublished(readPublished());
    restored.current = true;
  }, []);

  useEffect(() => {
    if (restored.current) writeDrafts(drafts);
  }, [drafts]);

  useEffect(() => {
    if (restored.current) writePublished(published);
  }, [published]);

  const active =
    openCourses.find((entry) => entry.id === activeId) ?? openCourses[0];
  if (!active) return null;

  const layout = tabLayout(openCourses.length);
  const panelId = `workspace-panel-${active.id}`;

  function patchDraft(courseCode: string, draft: ReviewDraft) {
    setDrafts((current) => ({ ...current, [courseCode]: draft }));
  }

  function markPublished(courseCode: string) {
    setPublished((current) => ({ ...current, [courseCode]: Date.now() }));
  }

  /** `reviews.list` has answered since, so the note has done its job. */
  function forgetPublished(courseCode: string) {
    setPublished((current) => {
      if (!(courseCode in current)) return current;
      const { [courseCode]: _sent, ...rest } = current;
      return rest;
    });
  }

  return (
    <section
      aria-label="Open courses"
      className={cn("flex min-h-0 min-w-0 flex-col", className)}
    >
      {!hideTabs && (
        <div className="flex items-end pl-0.5">
          <DropdownMenu>
            <DropdownMenuTrigger
              title="All open panes"
              aria-label="All open panes"
              className="mr-1.5 mb-0.5 flex h-[30px] w-[26px] flex-none items-center justify-center rounded-[7px] border border-cc-rule3 bg-cc-pill text-[14px] text-cc-ink2 leading-none data-[state=open]:bg-cc-rule2"
            >
              ▾
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="cc-theme max-h-[222px] w-[262px] overflow-y-auto border-cc-rule2 bg-cc-surface p-[5px] text-cc-ink"
            >
              {openCourses.map((entry) => (
                <DropdownMenuItem
                  key={entry.id}
                  onSelect={() => onActivate(entry.id)}
                  className={cn(
                    "gap-2.5 rounded-[7px] px-2.5 py-[7px] text-[12.5px] focus:bg-cc-pill",
                    entry.id === active.id
                      ? "font-semibold text-cc-brand"
                      : "text-cc-ink2",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="size-[7px] flex-none rounded-[2px]"
                    style={{ background: KIND_ACCENT[entry.kind] }}
                  />
                  <span className="flex-1 truncate">
                    {openCourseLabel(entry)}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div
            className="flex min-w-0 items-end"
            style={{ gap: `${layout.gap}px` }}
          >
            {openCourses.map((entry) => {
              const isActive = entry.id === active.id;
              const label = openCourseLabel(entry);
              return (
                <div
                  key={entry.id}
                  className="relative flex-none"
                  style={{
                    width: `${isActive ? layout.activeWidth : layout.inactiveWidth}px`,
                    marginBottom: isActive ? "-1px" : undefined,
                    zIndex: isActive ? 1 : 0,
                  }}
                >
                  <button
                    type="button"
                    aria-current={isActive}
                    aria-controls={isActive ? panelId : undefined}
                    aria-label={label}
                    title={label}
                    onClick={() => onActivate(entry.id)}
                    className={cn(
                      "flex h-[34px] w-full items-center gap-[7px] rounded-t-[9px] border border-cc-rule3 border-b-0 text-[12.5px]",
                      layout.tier === "tight"
                        ? "justify-center px-0"
                        : "justify-start px-[9px]",
                      isActive
                        ? "bg-cc-surface font-semibold text-cc-ink"
                        : "bg-cc-pill font-medium text-cc-dim",
                      isActive && layout.tier !== "tight" && "pr-6",
                    )}
                    style={{
                      boxShadow: `inset 0 3px 0 0 ${KIND_ACCENT[entry.kind]}`,
                    }}
                  >
                    <span
                      aria-hidden="true"
                      className="flex-none rounded-[2px]"
                      style={{
                        width: `${layout.dotSize}px`,
                        height: `${layout.dotSize}px`,
                        background: KIND_ACCENT[entry.kind],
                      }}
                    />
                    <span
                      aria-hidden="true"
                      className="min-w-0 flex-1 truncate text-left"
                    >
                      {tabLabel(entry.courseCode, layout.tier)}
                    </span>
                  </button>
                  {isActive && (
                    <button
                      type="button"
                      title="Close pane"
                      aria-label={`Close ${label}`}
                      onClick={() => onClose(entry.id)}
                      className="-translate-y-1/2 absolute top-1/2 right-1 flex size-5 items-center justify-center rounded-[5px] text-[15px] text-cc-dim leading-none hover:bg-cc-pill"
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <section
        id={panelId}
        aria-label={openCourseLabel(active)}
        className={cn(
          "scrollbar-subtle min-h-0 flex-1 overflow-auto bg-cc-surface",
          hideTabs
            ? "border-0"
            : "rounded-[0_12px_12px_12px] border border-cc-rule3 shadow-[0_1px_2px_rgba(20,30,45,0.05)]",
        )}
      >
        {/* Keyed by the tab, so switching courses gives the panel a fresh
            instance. Both panels hold state that belongs to one course — a
            published review, an expanded reviews list — and an unkeyed panel
            would carry it across to the next course it rendered. */}
        {active.kind === "details" ? (
          <CourseDetailsPanel
            key={active.id}
            courseCode={active.courseCode}
            onWriteReview={() => onOpen(active.courseCode, "review")}
          />
        ) : (
          <ReviewDraftPanel
            key={active.id}
            courseCode={active.courseCode}
            draft={drafts[active.courseCode] ?? EMPTY_REVIEW_DRAFT}
            publishedAt={published[active.courseCode] ?? null}
            onDraftChange={(draft) => patchDraft(active.courseCode, draft)}
            onPublished={() => markPublished(active.courseCode)}
            onPublishedConfirmed={() => forgetPublished(active.courseCode)}
          />
        )}
      </section>
    </section>
  );
}
