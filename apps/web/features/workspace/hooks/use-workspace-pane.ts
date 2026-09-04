"use client";

import { useCallback, useMemo, useState } from "react";
import {
  activateCourse,
  closeCourse,
  EMPTY_WORKSPACE,
  type OpenCourseKind,
  openCourse,
  type Workspace,
} from "../lib/open-courses";

/**
 * The open list, for a screen that hosts the workspace pane.
 *
 * The host owns it rather than the pane, because the host needs it: Explore
 * narrows its results column the moment anything is open, and Saved does the
 * same. A pane that hid this state would have to signal the count back out,
 * which is what the artboard does with a nonce prop and what React does not
 * need.
 */
export function useWorkspacePane() {
  const [workspace, setWorkspace] = useState<Workspace>(EMPTY_WORKSPACE);

  const open = useCallback((courseCode: string, kind: OpenCourseKind) => {
    setWorkspace((current) => openCourse(current, courseCode, kind));
  }, []);

  const close = useCallback((id: string) => {
    setWorkspace((current) => closeCourse(current, id));
  }, []);

  const activate = useCallback((id: string) => {
    setWorkspace((current) => activateCourse(current, id));
  }, []);

  const closeAll = useCallback(() => setWorkspace(EMPTY_WORKSPACE), []);

  return useMemo(
    () => ({
      /** Everything open, in tab order. Empty means the host hides the pane. */
      openCourses: workspace.open,
      activeId: workspace.activeId,
      /** True while the pane has anything to show. */
      hasOpenCourses: workspace.open.length > 0,
      open,
      close,
      activate,
      closeAll,
    }),
    [workspace, open, close, activate, closeAll],
  );
}
