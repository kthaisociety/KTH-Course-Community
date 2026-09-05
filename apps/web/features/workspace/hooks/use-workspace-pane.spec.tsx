import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useWorkspacePane } from "./use-workspace-pane";

beforeEach(() => {
  sessionStorage.clear();
});

describe("useWorkspacePane", () => {
  it("starts with nothing open, so the host hides the pane", () => {
    const { result } = renderHook(() => useWorkspacePane());

    expect(result.current.openCourses).toEqual([]);
    expect(result.current.hasOpenCourses).toBe(false);
  });

  it("opens, activates and closes courses", () => {
    const { result } = renderHook(() => useWorkspacePane());

    act(() => result.current.open("DD2380", "details"));
    act(() => result.current.open("SF1626", "details"));
    expect(result.current.activeId).toBe("details:SF1626");

    act(() => result.current.activate("details:DD2380"));
    expect(result.current.activeId).toBe("details:DD2380");

    act(() => result.current.close("details:DD2380"));
    expect(result.current.openCourses).toHaveLength(1);
    expect(result.current.activeId).toBe("details:SF1626");
  });

  it("brings the open courses back after the page reloads to sign in", () => {
    const first = renderHook(() => useWorkspacePane());
    act(() => first.result.current.open("DD2380", "details"));
    act(() => first.result.current.open("DD2380", "review"));
    first.unmount();

    const { result } = renderHook(() => useWorkspacePane());

    expect(result.current.openCourses.map((entry) => entry.id)).toEqual([
      "details:DD2380",
      "review:DD2380",
    ]);
    expect(result.current.activeId).toBe("review:DD2380");
  });

  it("does not restore a workspace that was closed down to nothing", () => {
    const first = renderHook(() => useWorkspacePane());
    act(() => first.result.current.open("DD2380", "details"));
    act(() => first.result.current.close("details:DD2380"));
    first.unmount();

    const { result } = renderHook(() => useWorkspacePane());

    expect(result.current.hasOpenCourses).toBe(false);
  });

  /**
   * The proof that the fix in `open-courses.ts` reaches React.
   *
   * `openCourse` returning the same object is only worth anything if `useState`
   * bails out on it, so this asserts what the two OOM crashes actually needed:
   * re-opening the course that is already in front **settles**. It does not
   * allocate a workspace per turn, and the value every host reads keeps its
   * identity, so no dependency downstream is rebuilt and nothing calls back in.
   *
   * The count is asserted as *not growing with the turns* rather than against a
   * number, because there is no honest number to assert. React may render the
   * owner of the state once before it bails out of the tree — documented and
   * bounded — and Strict Mode renders everything twice on top of that, so any
   * literal here would be a transcription of today's React rather than a
   * statement about this hook. What the loop needed was a count that climbed
   * with every turn; five more turns adding nothing is exactly the absence of
   * that, and it stays true whatever the multiplier is.
   *
   * Every other assertion is an identity one: a structural comparison would
   * pass on exactly the value that used to loop.
   */
  it("settles when the course already in front is opened again", () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useWorkspacePane();
    });

    act(() => result.current.open("DD2380", "details"));
    const workspace = result.current;

    function reopenFiveTimes() {
      for (let turn = 0; turn < 5; turn += 1) {
        act(() => result.current.open("DD2380", "details"));
        act(() => result.current.activate("details:DD2380"));
      }
    }

    reopenFiveTimes();
    const settled = renders;
    reopenFiveTimes();

    expect(renders).toBe(settled);
    expect(result.current).toBe(workspace);
    expect(result.current.openCourses).toBe(workspace.openCourses);
  });

  /*
   * The bug, at the hook. The mirror effect used to be gated on a ref set
   * inside the restore effect, which flips while `workspace` is still empty —
   * so one render's mirror wrote an empty workspace over the stored one, and
   * Strict Mode's replayed restore read exactly there and adopted it. A stored
   * workspace with one open tab came back as zero tabs.
   *
   * Asserted on what is left in storage as well as on what the hook returns,
   * because the return value recovers a render later and the storage does not.
   */
  it("does not blank the stored open list on the way to restoring it", () => {
    sessionStorage.setItem(
      "cc.workspace.open",
      JSON.stringify({
        open: [{ id: "review:DD2380", courseCode: "DD2380", kind: "review" }],
        activeId: "review:DD2380",
      }),
    );

    const { result } = renderHook(() => useWorkspacePane());

    expect(result.current.openCourses.map((entry) => entry.id)).toEqual([
      "review:DD2380",
    ]);
    expect(
      JSON.parse(sessionStorage.getItem("cc.workspace.open") ?? "{}").open,
    ).toHaveLength(1);
  });

  it("ignores whatever else is in the tab's storage", () => {
    sessionStorage.setItem(
      "cc.workspace.open",
      JSON.stringify({ open: [{ id: 1 }, "nope"], activeId: 7 }),
    );

    const { result } = renderHook(() => useWorkspacePane());

    expect(result.current.openCourses).toEqual([]);
  });
});
