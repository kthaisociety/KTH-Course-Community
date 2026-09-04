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

  it("ignores whatever else is in the tab's storage", () => {
    sessionStorage.setItem(
      "cc.workspace.open",
      JSON.stringify({ open: [{ id: 1 }, "nope"], activeId: 7 }),
    );

    const { result } = renderHook(() => useWorkspacePane());

    expect(result.current.openCourses).toEqual([]);
  });
});
