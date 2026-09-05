"use client";

import { X } from "lucide-react";
import { useRef, useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { OpenCourse, OpenCourseKind } from "../lib/open-courses";
import { openCourseLabel } from "../lib/open-courses";
import { WorkspacePane } from "./workspace-pane";

export interface MobileWorkspaceSheetHostProps {
  /** The host's workspace state; the newest active entry is the visible sheet. */
  openCourses: OpenCourse[];
  activeId: string | null;
  onClose: (id: string) => void;
  onOpen: (courseCode: string, kind: OpenCourseKind) => void;
}

const DISMISS_DISTANCE = 120;

/**
 * Mobile's presentation of the shared workspace.
 *
 * The workspace still owns the open-course list; this component only changes
 * its presentation from the desktop's resizable column to a bottom sheet. A
 * closed sheet reveals the still-open entry beneath it, so several course
 * details and review drafts remain available without routing away from the
 * list that opened them.
 */
export function MobileWorkspaceSheetHost({
  openCourses,
  activeId,
  onClose,
  onOpen,
}: Readonly<MobileWorkspaceSheetHostProps>) {
  const active =
    openCourses.find((entry) => entry.id === activeId) ?? openCourses.at(-1);
  const dragStart = useRef<number | null>(null);
  const dragOffset = useRef(0);
  const [dragY, setDragY] = useState(0);

  if (!active) return null;
  const activeEntry = active;

  function dismiss() {
    resetDrag();
    onClose(activeEntry.id);
  }

  function resetDrag() {
    dragStart.current = null;
    dragOffset.current = 0;
    setDragY(0);
  }

  function finishDrag() {
    if (dragStart.current === null) return;
    const shouldDismiss = dragOffset.current >= DISMISS_DISTANCE;
    resetDrag();
    if (shouldDismiss) onClose(activeEntry.id);
  }

  return (
    <Sheet open onOpenChange={(open) => !open && dismiss()}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        aria-describedby={undefined}
        className="gap-0 overflow-hidden rounded-t-[18px] border-t-[3px] border-cc-brand bg-cc-surface p-0 shadow-[0_-8px_30px_rgba(20,30,45,0.24)] max-h-[82dvh]"
        style={{ transform: `translateY(${dragY}px)` }}
      >
        <SheetTitle className="sr-only">
          {openCourseLabel(activeEntry)}
        </SheetTitle>
        <div className="relative flex h-12 shrink-0 items-center justify-center border-b border-cc-rule bg-cc-info">
          <button
            type="button"
            aria-label="Drag workspace sheet down to dismiss"
            onPointerDown={(event) => {
              dragStart.current = event.clientY;
              event.currentTarget.setPointerCapture?.(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (dragStart.current === null) return;
              const next = Math.max(0, event.clientY - dragStart.current);
              dragOffset.current = next;
              setDragY(next);
            }}
            onPointerUp={finishDrag}
            onPointerCancel={resetDrag}
            className="absolute inset-x-0 top-0 h-3 cursor-grab touch-none active:cursor-grabbing"
          >
            <span className="mx-auto block h-1 w-9 rounded-full bg-cc-rule3" />
          </button>
          <span className="text-[12.5px] font-semibold text-cc-ink">
            {openCourseLabel(activeEntry)}
          </span>
          <button
            type="button"
            aria-label={`Close ${openCourseLabel(activeEntry)}`}
            onClick={dismiss}
            className="absolute top-2 right-2 flex size-[30px] items-center justify-center rounded-[8px] bg-cc-surface text-cc-dim shadow-[0_1px_3px_rgba(20,30,45,0.15)] hover:bg-cc-pill"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
        <WorkspacePane
          className="min-h-0 flex-1 overflow-hidden"
          openCourses={[activeEntry]}
          activeId={activeEntry.id}
          onActivate={() => undefined}
          onClose={dismiss}
          onOpen={onOpen}
          hideTabs
        />
      </SheetContent>
    </Sheet>
  );
}
