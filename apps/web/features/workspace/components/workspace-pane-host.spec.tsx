import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WORKSPACE_COLUMN_FROM } from "../hooks/use-workspace-presentation";
import type { OpenCourse } from "../lib/open-courses";
import { WorkspacePaneHost } from "./workspace-pane-host";

// The pane's own content has its own suite, and rendering it here would pull
// the review editor's CSS into a test about a column's width.
vi.mock("./workspace-pane", () => ({
  WorkspacePane: () => <section aria-label="Open courses" />,
}));

/**
 * How wide the row reports itself. The pane is clamped against what the row can
 * spare, so a row that has never been measured — jsdom lays nothing out — is a
 * row with no room, and the pane would sit at its 356px minimum whatever the
 * artboard says.
 */
let rowWidth = 1200;

beforeEach(() => {
  rowWidth = 1200;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private readonly callback: ResizeObserverCallback) {}

      observe() {
        this.callback(
          [{ contentRect: { width: rowWidth } } as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        );
      }

      disconnect() {}
      unobserve() {}
    },
  );
});

const DETAILS: OpenCourse = {
  id: "details:DD2380",
  courseCode: "DD2380",
  kind: "details",
};

function host(openCourses: OpenCourse[]) {
  const rowRef = createRef<HTMLDivElement>();
  return render(
    <div ref={rowRef}>
      <WorkspacePaneHost
        rowRef={rowRef}
        openCourses={openCourses}
        activeId={openCourses.at(0)?.id ?? null}
        onActivate={vi.fn()}
        onClose={vi.fn()}
        onOpen={vi.fn()}
      />
    </div>,
  );
}

/**
 * Explore and Saved mount the same column (#127 §3), so what it does with no
 * open courses, and how wide it starts, is asserted once here rather than in
 * each host's screen test.
 */
describe("WorkspacePaneHost", () => {
  it("renders nothing at all while the workspace is empty", () => {
    host([]);

    expect(screen.queryByTestId("workspace-pane-host")).toBeNull();
    expect(screen.queryByLabelText("Open courses")).toBeNull();
  });

  // The artboards' own 504px, and their -14px handle beside it. The pane
  // itself arrives a tick later: it is a `next/dynamic` import, so browsing
  // never pays for the review editor behind it.
  it("opens at the artboard's width, with a handle that says what it does", async () => {
    host([DETAILS]);

    expect(screen.getByTestId("workspace-pane-host")).toHaveStyle({
      width: "504px",
    });
    expect(
      screen.getByRole("button", { name: "Resize workspace" }),
    ).toHaveAttribute("title", "Drag to resize · double-click to reset");
    expect(await screen.findByLabelText("Open courses")).toBeInTheDocument();
  });

  /**
   * The artboards give the results column the floor and make the pane yield —
   * `paneBounds()` in the Explore artboard hands the pane whatever is left once
   * the results have their 470px. At 900px of row that is 412px, not the 504px
   * the pane would rather be.
   */
  it("yields to the results column rather than keeping its width", () => {
    rowWidth = 900;
    host([DETAILS]);

    expect(screen.getByTestId("workspace-pane-host")).toHaveStyle({
      width: "412px",
    });
  });

  /**
   * The column is gated twice: on a container query so it paints in the first
   * frame on a wide screen, and on `useWorkspacePresentation` so the sheet and
   * the column are never both mounted. Two gates on one threshold drift unless
   * something holds them together, and this is that something — `@3xl` is
   * Tailwind's 768px.
   */
  it("is gated on the same width the presentation hook switches at", () => {
    host([DETAILS]);

    expect(WORKSPACE_COLUMN_FROM).toBe(768);
    expect(screen.getByTestId("workspace-pane-host")).toHaveClass(
      "hidden",
      "@3xl:flex",
    );
  });
});
