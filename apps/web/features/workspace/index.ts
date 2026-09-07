/**
 * The cross-feature API of the workspace feature.
 *
 * The **workspace pane** is the column Explore and Saved mount
 * beside their results: it holds every course the user has opened, one tab
 * each, either as course details or as a review draft. Since #68 §5 retired
 * `/course/<code>` it is the *only* place a course opens, so both hosts mount
 * it and everything a host needs to do that is exported here:
 *
 * - `useWorkspaceHost` and `WorkspaceHost`, which are the two halves a page
 *   actually wants: the state a host needs, and the presentation branch. A new
 *   host should reach for these and nothing below them;
 * - `WorkspacePaneHost` and `MobileWorkspaceSheetHost`, the two presentations,
 *   with `useWorkspacePresentation` deciding which of them renders;
 * - `useWorkspacePane`, the open list — the host owns it because the host has
 *   to size its own results column against it;
 * - `useResultsWidth`, the measurement of the column the pane narrows, which
 *   both hosts feed to the course card's collapse ramp;
 * - `openCourseRequest`, how a host reads `?open=` off its own route.
 *
 * The four pieces under `useWorkspaceHost` stay exported because the tests
 * reach for them and because a page with an unusual shape may still assemble
 * its own host; `WorkspacePane` likewise, for anything that wants the bare tab
 * strip without the column's width policy or its drag handle.
 */

export {
  MobileWorkspaceSheetHost,
  type MobileWorkspaceSheetHostProps,
} from "./components/mobile-workspace-sheet-host";
export {
  WorkspaceHost,
  type WorkspaceHostProps,
} from "./components/workspace-host";
export type { WorkspacePaneProps } from "./components/workspace-pane";
export { WorkspacePane } from "./components/workspace-pane";
export {
  WorkspacePaneHost,
  type WorkspacePaneHostProps,
} from "./components/workspace-pane-host";
export { useResultsWidth } from "./hooks/use-results-width";
export {
  useWorkspaceHost,
  type WorkspaceHostState,
} from "./hooks/use-workspace-host";
export { useWorkspacePane } from "./hooks/use-workspace-pane";
export {
  useWorkspacePresentation,
  WORKSPACE_COLUMN_FROM,
  type WorkspacePresentation,
} from "./hooks/use-workspace-presentation";
export type {
  OpenCourse,
  OpenCourseKind,
  OpenCourseRequest,
  WorkspaceScope,
} from "./lib/open-courses";
export { openCourseRequest } from "./lib/open-courses";
