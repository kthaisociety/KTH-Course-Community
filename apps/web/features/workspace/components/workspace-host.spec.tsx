import { act, render, renderHook, screen } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CARD_RAMP_FLOOR,
  COLLAPSED_CARD_GEOMETRY,
  EXPANDED_CARD_GEOMETRY,
} from "@/features/courses";
import {
  useWorkspaceHost,
  type WorkspaceHostState,
} from "../hooks/use-workspace-host";
import { WORKSPACE_COLUMN_FROM } from "../hooks/use-workspace-presentation";
import type { OpenCourse } from "../lib/open-courses";
import { WorkspaceHost } from "./workspace-host";

// Both presentations mount the same pane, and its content has its own suite.
// Rendering it here would pull the review editor into a test about a branch.
vi.mock("./workspace-pane", () => ({
  WorkspacePane: () => <section aria-label="Open courses" />,
}));

/**
 * How wide each observed element says it is.
 *
 * jsdom lays nothing out, so every width in this file is one this stub was
 * told to report. The hook observes two different boxes for two different
 * reasons — the container decides the presentation, the results column drives
 * the card's ramp — so the stub keys off the element rather than serving one
 * number to both, which is exactly the wiring this suite is here to pin.
 */
let widths = new Map<string, number>();

function widthOf(element: Element): number {
  for (const [testid, width] of widths) {
    if (element.getAttribute("data-testid") === testid) return width;
  }
  return 0;
}

beforeEach(() => {
  widths = new Map();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private readonly callback: ResizeObserverCallback) {}

      observe(element: Element) {
        this.callback(
          [
            {
              contentRect: { width: widthOf(element) },
            } as ResizeObserverEntry,
          ],
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

/** The column presentation renders this; the sheet does not. */
const paneColumn = () => screen.queryByTestId("workspace-pane-host");
/** The sheet renders a dialog; the column does not. */
const sheet = () => screen.queryByRole("dialog");

function hostState(
  presentation: WorkspaceHostState["presentation"],
  openCourses: OpenCourse[] = [DETAILS],
): WorkspaceHostState {
  return {
    presentation,
    rowRef: { current: null },
    containerRef: { current: null },
    resultsRef: { current: null },
    geo: EXPANDED_CARD_GEOMETRY,
    workspace: {
      openCourses,
      activeId: openCourses.at(0)?.id ?? null,
      hasOpenCourses: openCourses.length > 0,
      open: vi.fn(),
      close: vi.fn(),
      activate: vi.fn(),
    },
  };
}

/**
 * The invariant this component exists for.
 *
 * Explore and Saved used to restate it as a matched pair of ternaries each,
 * four in total, with nothing holding the four in step. It is asserted once
 * here instead — and asserted as *both* halves every time, because the failure
 * this guards against is not "the wrong one rendered" but "both did".
 */
describe("WorkspaceHost", () => {
  it("shows the column, and only the column, once measured wide", () => {
    render(<WorkspaceHost host={hostState("column")} />);

    expect(paneColumn()).toBeInTheDocument();
    expect(sheet()).toBeNull();
  });

  it("shows the sheet, and only the sheet, once measured narrow", () => {
    render(<WorkspaceHost host={hostState("sheet")} />);

    expect(sheet()).toBeInTheDocument();
    expect(paneColumn()).toBeNull();
  });

  /**
   * `null` is not "narrow". The column is gated on a container query as well,
   * so it paints on a wide screen before anything has measured; the sheet locks
   * the page's scroll and may only mount once the container really is narrow.
   * `useWorkspacePresentation`'s header argues this at length — the branch has
   * to agree with it.
   */
  it("takes the column branch while nothing has been measured", () => {
    render(<WorkspaceHost host={hostState(null)} />);

    expect(sheet()).toBeNull();
    expect(paneColumn()).toBeInTheDocument();
  });

  it("shows neither presentation while the workspace is empty", () => {
    const { rerender } = render(
      <WorkspaceHost host={hostState("column", [])} />,
    );

    expect(paneColumn()).toBeNull();
    expect(sheet()).toBeNull();

    rerender(<WorkspaceHost host={hostState("sheet", [])} />);

    expect(paneColumn()).toBeNull();
    expect(sheet()).toBeNull();
  });
});

/**
 * The other half of the seam: the six declarations both hosts used to open
 * with. What is asserted here is the wiring — that each ref reaches the hook it
 * is meant for — since that is the only thing an extraction of identical code
 * can actually get wrong.
 */
describe("useWorkspaceHost", () => {
  function Boxes({ host }: { host: WorkspaceHostState }) {
    return (
      <div data-testid="container" ref={host.containerRef}>
        <div data-testid="row" ref={host.rowRef}>
          <div data-testid="results" ref={host.resultsRef} />
        </div>
      </div>
    );
  }

  /**
   * Mounts the hook against real boxes, so the observers have something to
   * attach to. The container and the results column carry different widths on
   * purpose: crossing the two refs is the mistake these tests catch.
   */
  function mounted() {
    let latest: WorkspaceHostState | null = null;

    function Harness() {
      const host = useWorkspaceHost("explore");
      latest = host;
      return <Boxes host={host} />;
    }

    const view = render(<Harness />);
    return {
      ...view,
      get host() {
        if (!latest) throw new Error("the harness has not rendered");
        return latest;
      },
    };
  }

  it("reads the presentation off the container, not the results column", () => {
    widths.set("container", WORKSPACE_COLUMN_FROM - 1);
    widths.set("results", 2000);

    const view = mounted();

    expect(view.host.presentation).toBe("sheet");
  });

  it("ramps the card off the results column, not the container", () => {
    widths.set("container", 2000);
    widths.set("results", CARD_RAMP_FLOOR);

    const view = mounted();

    expect(view.host.geo).toEqual(COLLAPSED_CARD_GEOMETRY);
  });

  /**
   * An unmeasured column is the top of the ramp, not the bottom. jsdom reports
   * nothing, and so does a column that has not been laid out yet — a card
   * rendering fully collapsed in its first frame and expanding afterwards is
   * the defect `useResultsWidth` starts at `Infinity` to avoid.
   */
  it("starts expanded and unmeasured", () => {
    const { result } = renderHook(() => useWorkspaceHost("explore"));

    expect(result.current.presentation).toBeNull();
    expect(result.current.geo).toEqual(EXPANDED_CARD_GEOMETRY);
  });

  it("scopes the open list to the page it was asked for", () => {
    const explore = renderHook(() => useWorkspaceHost("explore"));
    act(() => explore.result.current.workspace.open("DD2380", "details"));

    const saved = renderHook(() => useWorkspaceHost("saved"));

    expect(explore.result.current.workspace.openCourses).toHaveLength(1);
    expect(saved.result.current.workspace.openCourses).toHaveLength(0);
  });

  /**
   * #189 asks every extraction pass for one of these, and this hook earns it:
   * it sits in the render path of both hosts, and it holds three observers that
   * each set state from what they measure. An observer that reacts to its own
   * commit is the loop this catches, and it would be invisible in the screen
   * tests — they would simply pass, slowly.
   *
   * What is asserted is that the mount **settles**, not a magic number: once
   * the measurements are in, further flushes must produce no more renders. The
   * ceiling below is only a second net, and it is loose on purpose — the exact
   * count is React's batching to decide, not this suite's.
   */
  it("settles, and its value stops changing once it has", async () => {
    let renders = 0;
    const seen: unknown[] = [];

    function Counter() {
      const host = useWorkspaceHost("explore");
      renders += 1;
      useEffect(() => {
        // Recorded from an effect keyed on the value: an identity rebuilt each
        // render appends here on every one of them.
        seen.push(host);
      }, [host]);
      return <Boxes host={host} />;
    }

    render(<Counter />);
    const settled = renders;
    const settledValues = seen.length;

    await act(async () => {});

    expect(renders).toBe(settled);
    expect(seen.length).toBe(settledValues);
    expect(settled).toBeLessThanOrEqual(4);
  });
});
