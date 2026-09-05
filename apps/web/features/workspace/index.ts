/**
 * The cross-feature API of the workspace feature.
 *
 * The **workspace pane** is the column Explore (#89) and Saved (#90) mount
 * beside their results: it holds every course the user has opened, one tab
 * each, either as course details or as a review draft. A host needs three
 * things — the pane, the open-list state it has to size its own column
 * against, and the type of an entry in that list.
 *
 * `WorkspacePane` is not mounted anywhere yet on purpose: the two screens that
 * host it are their own child issues, and wiring it into today's pre-design
 * `/search` would collide with the course card (#86), which is editing that
 * screen right now.
 */

export {
  MobileWorkspaceSheetHost,
  type MobileWorkspaceSheetHostProps,
} from "./components/mobile-workspace-sheet-host";
export type { WorkspacePaneProps } from "./components/workspace-pane";
export { WorkspacePane } from "./components/workspace-pane";
export { useWorkspacePane } from "./hooks/use-workspace-pane";
export type { OpenCourse, OpenCourseKind } from "./lib/open-courses";
