import { describe, expect, it } from "vitest";
import { courseNameKey } from "./name-key";

describe("courseNameKey", () => {
  it("ignores case, spacing and punctuation", () => {
    expect(courseNameKey("Industrial Management, Basic Course")).toBe(
      courseNameKey("industrial  management basic-course"),
    );
  });

  it("reads &, and and och as the same word", () => {
    expect(courseNameKey("Algebra & geometri")).toBe("algebraandgeometri");
    expect(courseNameKey("Algebra och geometri")).toBe("algebraandgeometri");
    expect(courseNameKey("Algebra and Geometry")).toBe("algebraandgeometry");
  });

  it("drops non-ASCII letters, as the SQL half does under any collation", () => {
    expect(courseNameKey("Linjär algebra")).toBe("linjralgebra");
    expect(courseNameKey("Ämnesdidaktik")).toBe(courseNameKey("ämnesdidaktik"));
  });
});
