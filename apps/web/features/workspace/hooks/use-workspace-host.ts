"use client";

import type { RefObject } from "react";
import { useMemo, useRef } from "react";
import { courseCardGeometry } from "@/features/courses";
import type { WorkspaceScope } from "../lib/open-courses";
import { useResultsWidth } from "./use-results-width";
import { useWorkspacePane } from "./use-workspace-pane";
import {
  useWorkspacePresentation,
  type WorkspacePresentation,
} from "./use-workspace-presentation";

/**
 * Everything a page needs in order to host the workspace, in one value.
 *
 * The type exists so `WorkspaceHost` can take the whole thing as a single prop:
 * the hook and the component are two halves of one seam, and passing the halves
 * separately is how a call site gets to wire them together wrongly.
 */
export interface WorkspaceHostState {
  /** The open list, scoped to this page. */
  workspace: ReturnType<typeof useWorkspacePane>;
  /** The box `useWorkspacePresentation` measures — the page's own column. */
  containerRef: RefObject<HTMLDivElement | null>;
  /** The row the results column and the pane share. */
  rowRef: RefObject<HTMLDivElement | null>;
  /** The results column, whose measured width drives the card's collapse ramp. */
  resultsRef: RefObject<HTMLDivElement | null>;
  /** That ramp, ready to hand to a course card. */
  geo: ReturnType<typeof courseCardGeometry>;
  /** Which presentation the container is wide enough for, `null` until measured. */
  presentation: WorkspacePresentation | null;
}

/**
 * The half of a workspace host that is the same on every page that has one.
 *
 * There are exactly two — `features/search/components/explore.tsx` and
 * `features/saved/components/saved.tsx` — and they used to open with these same
 * six declarations, differing only in the order they were written. The order
 * was the whole difference, so there was nothing to preserve: the refs, the
 * ramp and the presentation are one unit, and a page taking five of the six
 * would be broken rather than lighter.
 *
 * **The instruction half deliberately stays at the call site.** Saved drives
 * `workspace.open` from its own `?open=` handling while Explore routes the same
 * call through `useExplore`'s `onOpenCourse`; those are genuinely different
 * between the two pages and are not what this hook is for. It hosts the pane.
 * What a page tells the pane to show stays the page's own business.
 */
export function useWorkspaceHost(scope: WorkspaceScope): WorkspaceHostState {
  const workspace = useWorkspacePane(scope);
  const containerRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const presentation = useWorkspacePresentation(containerRef);
  const [resultsRef, resultsWidth] = useResultsWidth();

  /*
   * The ramp is a fresh object for every width, so it is kept to one object per
   * width. Both call sites hand it straight to `CourseCardItem`, and a page
   * shows a listful of those: a new `geo` on every render would put a new prop
   * identity on every card in the list each time anything above them changed.
   * Nothing downstream is memoised today, so this buys no render count back
   * yet — it stops the extraction from being the reason memoising a card later
   * does not work.
   */
  const geo = useMemo(() => courseCardGeometry(resultsWidth), [resultsWidth]);

  return useMemo(
    () => ({ workspace, containerRef, rowRef, resultsRef, geo, presentation }),
    [workspace, resultsRef, geo, presentation],
  );
}
