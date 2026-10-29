import { describe, expect, it } from "vitest";
import { normaliseCourseName } from "../ingest/transcript/match";
import { courseNameKey } from "./name-key";

describe("courseNameKey", () => {
  it("ignores case, spacing and punctuation", () => {
    expect(courseNameKey("Industrial Management, Basic Course")).toBe(
      courseNameKey("industrial  management basic-course"),
    );
  });

  it("reads &, and and och as the same word", () => {
    expect(courseNameKey("Algebra & geometri")).toBe("algebrageometri");
    expect(courseNameKey("Algebra och geometri")).toBe("algebrageometri");
    expect(courseNameKey("Algebra and Geometry")).toBe("algebrageometry");
  });

  it("finds a connective beside any separator, not only a plain space", () => {
    // A catalogue title with a non-breaking space, as the transcript parser's
    // rejoined name never has.
    expect(courseNameKey("Algebra och geometri")).toBe(
      courseNameKey("Algebra och geometri"),
    );
    expect(courseNameKey("Algebra,och–geometri")).toBe(
      courseNameKey("Algebra and geometri"),
    );
    expect(courseNameKey("Algebra och och geometri")).toBe("algebrageometri");
  });

  it("keeps a connective that is only part of a word", () => {
    expect(courseNameKey("Handling")).toBe("handling");
    expect(courseNameKey("Kochs metod")).toBe("kochsmetod");
  });

  it("drops non-ASCII letters, as the SQL half does under any collation", () => {
    expect(courseNameKey("Linjär algebra")).toBe("linjralgebra");
    expect(courseNameKey("Ämnesdidaktik")).toBe(courseNameKey("ämnesdidaktik"));
  });

  it("folds compatibility characters such as ligatures", () => {
    expect(courseNameKey("Scientiﬁc Writing")).toBe(
      courseNameKey("Scientific Writing"),
    );
    expect(courseNameKey("İnformatik")).toBe(courseNameKey("informatik"));
  });

  it("is never narrower than the transcript matcher's normalisation", () => {
    const spellings = [
      ["Algebra och geometri", "Algebra och geometri"],
      ["Algebra & geometri", "ALGEBRA AND GEOMETRI"],
      ["Människa–datorinteraktion", "människa datorinteraktion"],
      ["Linjär algebra, fortsättningskurs", "LINJÄR ALGEBRA FORTSÄTTNINGSKURS"],
      ["Scientiﬁc Computing", "scientific  computing"],
      ["R&D-management", "R and D management"],
      ["Programmering II", "programmering ii"],
    ];
    for (const [a, b] of spellings) {
      expect(normaliseCourseName(a)).toBe(normaliseCourseName(b));
      expect(courseNameKey(a)).toBe(courseNameKey(b));
    }
  });
});
