"use client";

import type { RefObject } from "react";
import { useEffect, useState } from "react";

/**
 * How a host is showing the workspace: the resizable column beside its results,
 * or the bottom sheet over them.
 */
export type WorkspacePresentation = "column" | "sheet";

/**
 * The container width at which the pane becomes a column, in pixels.
 *
 * It is Tailwind's `@3xl`, because the column itself is gated on that class:
 * one threshold in two places would drift, so the number is here and the class
 * is checked against it by `workspace-pane-host.spec.tsx`.
 */
export const WORKSPACE_COLUMN_FROM = 768;

/**
 * Which presentation a host container is wide enough for, or `null` until
 * something has measured it.
 *
 * The two presentations are one state machine — the same open list, opened by
 * the same call — so this decides only what renders, never what a click does.
 * That matters now that there is no course page to fall back to: since #68 §5
 * retired `/course/<code>`, every width must show the pane somehow, and a host
 * that could not yet tell which one would otherwise have nowhere to put a
 * course the reader just opened.
 *
 * `null` is not "narrow". The column is gated on a container query as well, so
 * it paints on a wide screen before this hook has run; the sheet is a Radix
 * `Sheet` that locks the page's scroll, so it may only mount once the container
 * has actually been measured as narrow. Guessing would briefly freeze a desktop
 * page behind a sheet that then vanished.
 */
export function useWorkspacePresentation(
  containerRef: RefObject<HTMLElement | null>,
): WorkspacePresentation | null {
  const [presentation, setPresentation] =
    useState<WorkspacePresentation | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect.width ?? container.clientWidth;
      setPresentation(width >= WORKSPACE_COLUMN_FROM ? "column" : "sheet");
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef]);

  return presentation;
}
