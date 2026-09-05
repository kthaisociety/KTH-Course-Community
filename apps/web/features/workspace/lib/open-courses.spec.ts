import { describe, expect, it } from "vitest";
import {
  activateCourse,
  closeCourse,
  EMPTY_WORKSPACE,
  openCourse,
  openCourseLabel,
  openCourseRequest,
  tabLabel,
  tabLayout,
  type Workspace,
} from "./open-courses";

function withOpen(...codes: string[]): Workspace {
  return codes.reduce(
    (workspace, code) => openCourse(workspace, code, "details"),
    EMPTY_WORKSPACE,
  );
}

describe("openCourse", () => {
  it("opens a course and brings it to the front", () => {
    const workspace = openCourse(EMPTY_WORKSPACE, "DD2380", "details");

    expect(workspace.open).toEqual([
      { id: "details:DD2380", courseCode: "DD2380", kind: "details" },
    ]);
    expect(workspace.activeId).toBe("details:DD2380");
  });

  it("re-opening an open course activates it instead of duplicating it", () => {
    const workspace = openCourse(
      withOpen("DD2380", "SF1626"),
      "DD2380",
      "details",
    );

    expect(workspace.open).toHaveLength(2);
    expect(workspace.activeId).toBe("details:DD2380");
  });

  it("keeps details and a review draft for one course as two tabs", () => {
    const workspace = openCourse(withOpen("DD2380"), "DD2380", "review");

    expect(workspace.open.map((entry) => entry.kind)).toEqual([
      "details",
      "review",
    ]);
    expect(workspace.activeId).toBe("review:DD2380");
  });

  /*
   * The render-loop tripwire, and the reason it is an identity assertion rather
   * than an equality one.
   *
   * Three unbounded render loops have shipped on this branch and every one had
   * the same shape: an effect calls into the workspace, the workspace hands back
   * a fresh object for what was a no-op, `useState` therefore cannot bail out,
   * the host re-renders, something the effect depends on is rebuilt, and the
   * effect runs again. `toEqual` would pass on the value that causes that.
   * `toBe` is the only assertion that holds the fix.
   */
  it("returns the same workspace when the course is already open and in front", () => {
    const workspace = withOpen("DD2380", "SF1626");

    expect(openCourse(workspace, "SF1626", "details")).toBe(workspace);
  });

  it("still allocates when re-opening brings a background tab forward", () => {
    const workspace = withOpen("DD2380", "SF1626");
    const next = openCourse(workspace, "DD2380", "details");

    expect(next).not.toBe(workspace);
    expect(next.activeId).toBe("details:DD2380");
    // The tab list itself is untouched, so a host memoised on `openCourses`
    // alone does not rebuild for a change that only moved the front.
    expect(next.open).toBe(workspace.open);
  });
});

describe("activateCourse", () => {
  it("returns the same workspace when the tab is already in front", () => {
    const workspace = withOpen("DD2380", "SF1626");

    expect(activateCourse(workspace, "details:SF1626")).toBe(workspace);
  });

  it("brings a background tab forward", () => {
    const workspace = withOpen("DD2380", "SF1626");

    expect(activateCourse(workspace, "details:DD2380").activeId).toBe(
      "details:DD2380",
    );
  });

  it("returns the same workspace for an id that is not open", () => {
    const workspace = withOpen("DD2380");

    expect(activateCourse(workspace, "details:NOPE")).toBe(workspace);
  });
});

describe("closeCourse", () => {
  it("hands the front to the tab that slid into its place", () => {
    const workspace = closeCourse(
      withOpen("DD2380", "SF1626", "DH2642"),
      "details:SF1626",
    );

    expect(workspace.open.map((entry) => entry.courseCode)).toEqual([
      "DD2380",
      "DH2642",
    ]);
    expect(workspace.activeId).toBe("details:DH2642");
  });

  it("falls back to the new last tab when the rightmost closes", () => {
    const workspace = closeCourse(
      withOpen("DD2380", "SF1626"),
      "details:SF1626",
    );

    expect(workspace.activeId).toBe("details:DD2380");
  });

  it("leaves the front alone when another tab closes", () => {
    const open = withOpen("DD2380", "SF1626", "DH2642");
    const workspace = closeCourse(
      activateCourse(open, "details:DH2642"),
      "details:DD2380",
    );

    expect(workspace.activeId).toBe("details:DH2642");
  });

  it("empties the workspace when the last tab closes", () => {
    expect(closeCourse(withOpen("DD2380"), "details:DD2380")).toEqual(
      EMPTY_WORKSPACE,
    );
  });

  it("ignores an id that is not open", () => {
    const open = withOpen("DD2380");
    expect(closeCourse(open, "details:NOPE")).toBe(open);
  });
});

describe("tabLayout", () => {
  it("carries the whole code up to four tabs", () => {
    expect(tabLayout(4).tier).toBe("wide");
    expect(tabLabel("DD2380", tabLayout(4).tier)).toBe("DD2380");
  });

  it("drops the school prefix from five tabs", () => {
    expect(tabLayout(5).tier).toBe("medium");
    expect(tabLabel("DD2380", tabLayout(5).tier)).toBe("2380");
  });

  it("shows the colour dot alone past eight tabs", () => {
    expect(tabLayout(9).tier).toBe("tight");
    expect(tabLabel("DD2380", tabLayout(9).tier)).toBe("");
  });

  it("never widens a tab as more open", () => {
    expect(tabLayout(9).activeWidth).toBeLessThan(tabLayout(5).activeWidth);
    expect(tabLayout(5).activeWidth).toBeLessThan(tabLayout(4).activeWidth);
  });
});

describe("openCourseLabel", () => {
  it("names the kind in the reader's words, not the identifier's", () => {
    expect(
      openCourseLabel({
        id: "review:DD2380",
        courseCode: "DD2380",
        kind: "review",
      }),
    ).toBe("DD2380 · Review draft");
  });
});

/**
 * `/course/<code>` redirects onto this pair (#68 §5), and Collections navigates
 * to Saved with it, so it is read off a URL that people paste and edit.
 */
describe("openCourseRequest", () => {
  it("reads the pair a host was navigated with", () => {
    expect(openCourseRequest("DD2380", "review")).toEqual({
      courseCode: "DD2380",
      kind: "review",
    });
  });

  // `/course/dd2380` was a working URL; the catalogue keys courses upper-case.
  it("upper-cases a hand-typed code, and trims it", () => {
    expect(openCourseRequest("  dd2380 ", null)?.courseCode).toBe("DD2380");
  });

  it("opens the course rather than refusing an unusable kind", () => {
    expect(openCourseRequest("DD2380", null)?.kind).toBe("details");
    expect(openCourseRequest("DD2380", "")?.kind).toBe("details");
    expect(openCourseRequest("DD2380", "nonsense")?.kind).toBe("details");
  });

  it("asks for nothing when no course is named", () => {
    expect(openCourseRequest(null, "review")).toBeNull();
    expect(openCourseRequest(undefined, undefined)).toBeNull();
    expect(openCourseRequest("   ", "details")).toBeNull();
  });
});
