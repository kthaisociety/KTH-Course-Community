"use client";

import type { WorkspaceHostState } from "../hooks/use-workspace-host";
import { MobileWorkspaceSheetHost } from "./mobile-workspace-sheet-host";
import { WorkspacePaneHost } from "./workspace-pane-host";

export interface WorkspaceHostProps {
  /** The whole of `useWorkspaceHost`'s return, unpicked apart. */
  host: WorkspaceHostState;
}

/**
 * The workspace, in whichever presentation the host page is wide enough for.
 *
 * Two presentations of one open list, and **never both at once** — the column
 * until the container has been measured as narrow, the sheet after. That
 * invariant is the reason this component exists: it used to be restated as a
 * matched pair of ternaries at the bottom of both Explore and Saved, where
 * nothing stopped the two branches from drifting apart. Here there is one
 * `presentation` read and one place to get it wrong.
 *
 * See `useWorkspacePresentation` for why `null` is not "narrow".
 *
 * ## Why both may be rendered from one place in the row
 *
 * The two used to sit at different depths — the column inside the row it shares
 * with the results, the sheet outside it — which is what made a single owner
 * look impossible. It is not: the sheet is a Radix `Sheet`, so `SheetContent`
 * portals to the body and its position in the React tree decides nothing about
 * where it paints. Only the column is laid out where this component is mounted,
 * and the row is exactly where the column belongs.
 */
export function WorkspaceHost({ host }: Readonly<WorkspaceHostProps>) {
  const { presentation, rowRef, workspace } = host;

  if (presentation === "sheet") {
    return (
      <MobileWorkspaceSheetHost
        openCourses={workspace.openCourses}
        activeId={workspace.activeId}
        onClose={workspace.close}
        onOpen={workspace.open}
      />
    );
  }

  return (
    <WorkspacePaneHost
      rowRef={rowRef}
      openCourses={workspace.openCourses}
      activeId={workspace.activeId}
      onActivate={workspace.activate}
      onClose={workspace.close}
      onOpen={workspace.open}
    />
  );
}
