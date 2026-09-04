import { describe, expect, it } from "vitest";
import {
  addableCourseCodes,
  courseCountLabel,
  moveCourse,
  overflowLabel,
} from "./collection-model";

describe("courseCountLabel", () => {
  it("counts one course in the singular", () => {
    expect(courseCountLabel(1)).toBe("1 course");
  });

  it("counts anything else in the plural, an empty collection included", () => {
    expect(courseCountLabel(0)).toBe("0 courses");
    expect(courseCountLabel(4)).toBe("4 courses");
  });
});

describe("overflowLabel", () => {
  it("says nothing while the tile still lists every course", () => {
    expect(overflowLabel(0)).toBeNull();
    expect(overflowLabel(3)).toBeNull();
  });

  it("counts the courses the tile had no room for", () => {
    expect(overflowLabel(4)).toBe("+1 more");
    expect(overflowLabel(9)).toBe("+6 more");
  });
});

describe("addableCourseCodes", () => {
  // The rule the database enforces: a course may only join a collection its
  // owner has also saved. The list is built from the saved codes, so an unsaved
  // course has no way into it.
  it("offers only saved courses", () => {
    expect(addableCourseCodes(["AA1000", "BB2000"], [])).toEqual([
      "AA1000",
      "BB2000",
    ]);
  });

  it("leaves out the courses the collection already holds", () => {
    expect(
      addableCourseCodes(["AA1000", "BB2000", "CC3000"], ["BB2000"]),
    ).toEqual(["AA1000", "CC3000"]);
  });

  it("offers nothing when every saved course is already in", () => {
    expect(addableCourseCodes(["AA1000"], ["AA1000"])).toEqual([]);
  });
});

describe("moveCourse", () => {
  const ORDER = ["AA1000", "BB2000", "CC3000"];

  it("swaps a course with the one above it", () => {
    expect(moveCourse(ORDER, "BB2000", "up")).toEqual([
      "BB2000",
      "AA1000",
      "CC3000",
    ]);
  });

  it("swaps a course with the one below it", () => {
    expect(moveCourse(ORDER, "BB2000", "down")).toEqual([
      "AA1000",
      "CC3000",
      "BB2000",
    ]);
  });

  it("leaves the order alone at either end", () => {
    expect(moveCourse(ORDER, "AA1000", "up")).toEqual(ORDER);
    expect(moveCourse(ORDER, "CC3000", "down")).toEqual(ORDER);
  });

  it("leaves the order alone for a course that is not in it", () => {
    expect(moveCourse(ORDER, "ZZ9000", "up")).toEqual(ORDER);
  });

  it("never mutates the order it was given", () => {
    const original = [...ORDER];
    moveCourse(ORDER, "BB2000", "up");
    expect(ORDER).toEqual(original);
  });
});
