import { describe, expect, it } from "vitest";
import { matchCandidates } from "./match";
import type { TranscriptCandidate } from "./parse";

const candidate = (
  courseCode: string,
  overrides: Partial<TranscriptCandidate> = {},
): TranscriptCandidate => ({
  courseCode,
  courseName: `Course ${courseCode}`,
  credits: 7.5,
  grade: "A",
  completedOn: "2024-01-12",
  ...overrides,
});

describe("matchCandidates", () => {
  it("keeps the courses the catalogue knows", () => {
    const result = matchCandidates(
      [candidate("SF1625"), candidate("DD1337")],
      ["SF1625", "DD1337", "ME1003"],
    );

    expect(result.matched.map((row) => row.courseCode)).toEqual([
      "SF1625",
      "DD1337",
    ]);
    expect(result.unmatched).toEqual([]);
  });

  it("reports a code the catalogue does not have rather than inventing it", () => {
    const result = matchCandidates(
      [candidate("SF1625"), candidate("ZZ9999", { courseName: "Retired" })],
      ["SF1625"],
    );

    expect(result.matched.map((row) => row.courseCode)).toEqual(["SF1625"]);
    expect(result.unmatched).toEqual([
      { courseCode: "ZZ9999", courseName: "Retired" },
    ]);
  });

  it("matches regardless of how the transcript cased or spaced the code", () => {
    const result = matchCandidates([candidate(" sf1625 ")], ["SF1625"]);

    expect(result.matched).toEqual([
      expect.objectContaining({ courseCode: "SF1625" }),
    ]);
    expect(result.unmatched).toEqual([]);
  });

  it("keeps one row per course code", () => {
    const result = matchCandidates(
      [
        candidate("SF1625", { grade: "C" }),
        candidate("SF1625", { grade: "A" }),
      ],
      ["SF1625"],
    );

    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].grade).toBe("C");
  });
});
