"use client";

import dynamic from "next/dynamic";
import type { RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { OpenCourse, OpenCourseKind } from "../lib/open-courses";

// The pane is inactive for ordinary browsing and has its own data-heavy
// details/review views. Load it only once a reader opens a course.
const WorkspacePane = dynamic(
  () => import("./workspace-pane").then((module) => module.WorkspacePane),
  { ssr: false },
);

/**
 * The width the results column keeps for itself before the pane may grow.
 *
 * Both artboards say 396 and both call it "the cropped card's own minimum" —
 * `Course Community - Saved.dc.html` line 842 clamps the pane to
 * `rowW - 396 - 40 - 18`, and `Course Community - Explore.dc.html` line 507
 * names the same number `RESULTS_FLOOR`. It is deliberately *not* 470: 470 is
 * `CARD_RAMP_FLOOR`, the width at which the card finishes collapsing, and the
 * artboard lets the column go on past it to 396 because a fully collapsed card
 * is still a readable card. Confusing the two costs the pane 74px it is drawn
 * with, so the distinction is written down here.
 */
const RESULTS_FLOOR = 396;
/** The narrowest the pane is ever drawn. */
const PANE_MIN = 356;
/** The artboard's own starting width, and what a double-click resets to. */
const PANE_DEFAULT = 504;
/** The gap between the results column and the pane, from both artboards. */
const WORKSPACE_GAP = 18;

export interface WorkspacePaneHostProps {
  /**
   * The row the pane shares with the results column. Its measured width is
   * what the pane's own is clamped against, so the results never lose their
   * floor to a drag.
   */
  rowRef: RefObject<HTMLDivElement | null>;
  /** The host's open list. An empty one renders nothing at all. */
  openCourses: OpenCourse[];
  activeId: string | null;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onOpen: (courseCode: string, kind: OpenCourseKind) => void;
}

/**
 * The workspace pane as a resizable column beside a host's results.
 *
 * Explore and Saved draw the same thing — `Course Community - Explore.dc.html`
 * line 277 and `Course Community - Saved.dc.html` line 166 import the pane with
 * an identical contract, down to the 504px hint and the -14px handle — so the
 * column, its drag handle and its width policy live here rather than twice.
 * The host keeps only what is genuinely its own: the open list (it sizes its
 * results column against it) and the row it hands down.
 *
 * The column is gated on a container query (`@3xl`) as well as on
 * `useWorkspacePresentation`, so it paints on a wide screen in the first frame,
 * before any observer has run.
 */
export function WorkspacePaneHost({
  rowRef,
  openCourses,
  activeId,
  onActivate,
  onClose,
  onOpen,
}: Readonly<WorkspacePaneHostProps>) {
  const pane = useWorkspaceWidth(rowRef, openCourses.length > 0);

  if (openCourses.length === 0) return null;

  return (
    <div
      data-testid="workspace-pane-host"
      className="relative hidden min-h-0 min-w-[356px] @3xl:flex"
      style={{ width: pane.width }}
    >
      <WorkspaceResizeHandle pane={pane} />
      <WorkspacePane
        className="min-w-0 flex-1"
        openCourses={openCourses}
        activeId={activeId}
        onActivate={onActivate}
        onClose={onClose}
        onOpen={onOpen}
      />
    </div>
  );
}

/**
 * How wide the pane is, against how wide the row actually is.
 *
 * The artboards give the results column the floor and make the pane yield:
 * `paneBounds()` in the Explore artboard hands the pane whatever is left once
 * the results have their `RESULTS_FLOOR`, never the other way round. So the
 * width the reader dragged is remembered as they dragged it and clamped on the
 * way out — narrowing the window and widening it again returns the pane to the
 * size they chose rather than to whatever the narrow moment allowed.
 *
 * Two of that function's branches are deliberately not built. It also carries a
 * `PANE_FLOOR` of 440 — a "comfortable" minimum it prefers over `PANE_MIN`
 * while the row can afford one — and a `stack` / `solo` mode that gives the
 * pane the whole row when neither floor fits side by side. Here the row stops
 * being a row below `WORKSPACE_COLUMN_FROM` instead: the pane becomes the
 * mobile sheet, which is `solo` under another name, and `PANE_FLOOR` would only
 * ever change how far in a drag may go. Neither earns a second width policy.
 */
function useWorkspaceWidth(
  rowRef: RefObject<HTMLDivElement | null>,
  active: boolean,
) {
  const [width, setWidth] = useState(PANE_DEFAULT);
  const [rowWidth, setRowWidth] = useState(0);

  useEffect(() => {
    const row = rowRef.current;
    if (!row || typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(([entry]) => {
      setRowWidth(entry?.contentRect.width ?? row.clientWidth);
    });
    observer.observe(row);
    return () => observer.disconnect();
  }, [rowRef]);

  /*
   * A row of 0 has not been measured; it is never a row with no room. The host
   * mounts in the same commit as the pane, so the first clamp runs before the
   * observer has reported anything — and the clamp is destructive, because
   * `width` is the width the reader dragged. Clamping 504 against an unmeasured
   * row would pin the pane to its 356px minimum and leave it there, since every
   * later clamp starts from the squashed value.
   */
  const room =
    rowWidth > 0
      ? rowWidth - RESULTS_FLOOR - WORKSPACE_GAP
      : Number.POSITIVE_INFINITY;
  const max = Math.max(PANE_MIN, room);
  const clamp = useCallback(
    (next: number) => Math.max(PANE_MIN, Math.min(next, max)),
    [max],
  );

  useEffect(() => {
    if (active) setWidth((current) => clamp(current));
  }, [active, clamp]);

  return {
    width: clamp(width),
    resize: (next: number) => setWidth(clamp(next)),
    reset: () => setWidth(clamp(PANE_DEFAULT)),
  };
}

/** How far one arrow-key press moves the handle. */
const KEYBOARD_STEP = 24;

/**
 * The drag handle, and the only control that changes the pane's width.
 *
 * The artboard's is a bare `div` with an `onPointerDown`, so it is reachable by
 * pointer alone. This one is a `<button>`, which makes it focusable — and a
 * focusable control that does nothing when focused is worse than one that
 * cannot be reached at all, so the arrow keys nudge the pane by `KEYBOARD_STEP`
 * and Home resets it. That is the same three outcomes the pointer has, since a
 * double-click resets too.
 *
 * Not `role="separator"`, which is the ARIA window-splitter this behaves like:
 * Biome's `a11y/useSemanticElements` rejects the role on anything that is not
 * an `<hr>`, and a splitter's `aria-valuenow` triple would then be sitting on a
 * role that does not define it. A named button whose keys work is the honest
 * version of the same control.
 */
function WorkspaceResizeHandle({
  pane,
}: {
  pane: ReturnType<typeof useWorkspaceWidth>;
}) {
  const drag = useRef<{
    onMove: (event: PointerEvent) => void;
  } | null>(null);

  const finish = useCallback(() => {
    const activeDrag = drag.current;
    if (!activeDrag) return;
    window.removeEventListener("pointermove", activeDrag.onMove);
    window.removeEventListener("pointerup", finish);
    window.removeEventListener("pointercancel", finish);
    drag.current = null;
  }, []);

  useEffect(() => finish, [finish]);

  return (
    <button
      type="button"
      aria-label="Resize workspace"
      title="Drag to resize · arrow keys to nudge · double-click to reset"
      onDoubleClick={pane.reset}
      onKeyDown={(event) => {
        // The handle sits on the pane's left edge, so left widens it.
        if (event.key === "ArrowLeft") pane.resize(pane.width + KEYBOARD_STEP);
        else if (event.key === "ArrowRight")
          pane.resize(pane.width - KEYBOARD_STEP);
        else if (event.key === "Home") pane.reset();
        else return;
        event.preventDefault();
      }}
      onPointerDown={(event) => {
        event.preventDefault();
        finish();
        const startX = event.clientX;
        const startWidth = pane.width;
        const onMove = (moveEvent: PointerEvent) => {
          pane.resize(startWidth - (moveEvent.clientX - startX));
        };
        drag.current = { onMove };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", finish, { once: true });
        window.addEventListener("pointercancel", finish, { once: true });
      }}
      className="-left-[14px] absolute top-0 hidden h-full w-[11px] cursor-col-resize items-center justify-center @3xl:flex"
    >
      <span
        aria-hidden
        className="h-[34px] w-[2px] rounded-[2px] bg-cc-rule3"
      />
    </button>
  );
}
