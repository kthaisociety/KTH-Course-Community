"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  activateCourse,
  closeCourse,
  EMPTY_WORKSPACE,
  type OpenCourseKind,
  openCourse,
  type Workspace,
  type WorkspaceScope,
} from "../lib/open-courses";
import { readWorkspace, writeWorkspace } from "../lib/workspace-storage";

/**
 * The open list, for a screen that hosts the workspace pane.
 *
 * The host owns it rather than the pane, because the host needs it: Explore
 * narrows its results column the moment anything is open, and Saved does the
 * same. A pane that hid this state would have to signal the count back out,
 * which is what the artboard does with a nonce prop and what React does not
 * need.
 *
 * It survives a page load through `sessionStorage`, so that signing in — an
 * OAuth redirect away and back — returns the student to the courses they had
 * open rather than to an empty pane. Restoring happens in an effect rather
 * than in the initial state so the server and the first client render agree.
 *
 * ## The scope, and why it is a parameter
 *
 * Each host passes its own {@link WorkspaceScope}, and that is what keeps
 * Explore's tabs out of Saved: the two pages read and write separate keys, so
 * navigating between them no longer rehydrates the other's list. Signing in
 * still returns a reader to their tabs, because the redirect comes back to the
 * *same* route and therefore to the same scope.
 *
 * It is passed in rather than read off `usePathname()` so the hook stays pure
 * and testable and the host goes on owning its own state, which is the shape
 * the rest of this comment describes. A host's scope is a literal and never
 * changes for the life of the mount; the read guard below would not notice if
 * it did.
 *
 * ## Why `hydrated` is state and not a ref
 *
 * The mirror effect below must not run before the restore effect above, and
 * the gate that says so has to be committed *with* the value it guards. A ref
 * is not: `restored.current = true` inside the restore effect flips
 * synchronously while `workspace` is still `EMPTY_WORKSPACE`, so for exactly
 * one render the mirror is armed over pre-restore state and writes an empty
 * workspace over the stored one. It self-heals on the next commit — and too
 * late for anything that reads storage inside that window. React Strict Mode
 * replaying the mount effects reads precisely there, which is why a stored
 * workspace with one open tab came back as zero tabs in development.
 *
 * As state, `hydrated` cannot be `true` in a render where `workspace` is still
 * the placeholder, so there is no write path that can carry one. Same bug, same
 * shape and same fix as the drafts and published maps in `workspace-pane.tsx`;
 * the long version of the reasoning, including why write-through was not the
 * answer, is written out there.
 *
 * ## And why the *read* is guarded by a ref, which is not the same thing
 *
 * Restoring must happen once per mount, ever — not once per effect run. Strict
 * Mode runs the mount effects, tears them down and runs them again, and by the
 * second pass the workspace may already have moved: `use-explore.ts` spends a
 * `?open=` in its own mount effect, so a reader arriving on
 * `/course/DD2380` has a tab open before the replay, and a replayed restore
 * reads storage that has not caught up yet and puts the empty workspace back.
 * The tab opens and vanishes in the same commit, and `use-explore` will not
 * reopen it because it has already spent the instruction.
 *
 * So the two guards guard different things and are deliberately different
 * kinds. `read.current` is a ref because it has to survive the replay — that is
 * exactly what makes it able to say "already done". `hydrated` is state because
 * it has to arrive *with* the value it describes. Swapping them is the bug at
 * both ends.
 */
export function useWorkspacePane(scope: WorkspaceScope) {
  const [workspace, setWorkspace] = useState<Workspace>(EMPTY_WORKSPACE);
  const [hydrated, setHydrated] = useState(false);
  const read = useRef(false);

  useEffect(() => {
    if (read.current) return;
    read.current = true;
    setWorkspace(readWorkspace(scope));
    setHydrated(true);
  }, [scope]);

  useEffect(() => {
    if (hydrated) writeWorkspace(scope, workspace);
  }, [hydrated, scope, workspace]);

  const open = useCallback((courseCode: string, kind: OpenCourseKind) => {
    setWorkspace((current) => openCourse(current, courseCode, kind));
  }, []);

  const close = useCallback((id: string) => {
    setWorkspace((current) => closeCourse(current, id));
  }, []);

  const activate = useCallback((id: string) => {
    setWorkspace((current) => activateCourse(current, id));
  }, []);

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
    }),
    [workspace, open, close, activate],
  );
}
