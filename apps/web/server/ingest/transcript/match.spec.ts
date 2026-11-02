import { describe, expect, it } from "vitest";
import {
  type CatalogueCourse,
  matchCandidates,
  normaliseCourseName,
} from "./match";
import type { TranscriptCandidate } from "./parse";

const candidate = (
  courseCode: string | null,
  overrides: Partial<TranscriptCandidate> = {},
): TranscriptCandidate => ({
  courseCode,
  courseName: `Course ${courseCode}`,
  credits: 7.5,
  grade: "A",
  completedOn: "2024-01-12",
  ...overrides,
});

const named = (
  courseName: string,
  overrides: Partial<TranscriptCandidate> = {},
): TranscriptCandidate => candidate(null, { courseName, ...overrides });

const course = (
  courseCode: string,
  overrides: Partial<CatalogueCourse> = {},
): CatalogueCourse => ({
  courseCode,
  titleEng: `Course ${courseCode}`,
  titleSwe: null,
  credits: 7.5,
  ...overrides,
});

const courses = (...codes: string[]) => codes.map((code) => course(code));

describe("matchCandidates", () => {
  describe("a row that printed a course code", () => {
    it("keeps the courses the catalogue knows", () => {
      const result = matchCandidates(
        [candidate("SF1625"), candidate("DD1337")],
        courses("SF1625", "DD1337", "ME1003"),
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
        courses("SF1625"),
      );

      expect(result.matched.map((row) => row.courseCode)).toEqual(["SF1625"]);
      expect(result.unmatched).toEqual([
        { courseCode: "ZZ9999", courseName: "Retired" },
      ]);
    });

    it("matches regardless of how the transcript cased or spaced the code", () => {
      const result = matchCandidates(
        [candidate(" sf1625 ")],
        courses("SF1625"),
      );

      expect(result.matched).toEqual([
        expect.objectContaining({ courseCode: "SF1625" }),
      ]);
      expect(result.unmatched).toEqual([]);
    });

    it("is matched by its code, not by a name another course has", () => {
      const result = matchCandidates(
        [candidate("ZZ9999", { courseName: "Programming" })],
        [course("DD1337", { titleEng: "Programming" })],
      );

      expect(result.matched).toEqual([]);
      expect(result.unmatched).toEqual([
        { courseCode: "ZZ9999", courseName: "Programming" },
      ]);
    });

    it("keeps one row per course code", () => {
      const result = matchCandidates(
        [
          candidate("SF1625", { grade: "C" }),
          candidate("SF1625", { grade: "A" }),
        ],
        courses("SF1625"),
      );

      expect(result.matched).toHaveLength(1);
      expect(result.matched[0].grade).toBe("C");
    });
  });

  describe("a row without a course code", () => {
    it("is matched by its English name and takes the catalogue's code", () => {
      const result = matchCandidates(
        [named("Calculus in One Variable", { grade: "B" })],
        [course("SF1625", { titleEng: "Calculus in One Variable" })],
      );

      expect(result.matched).toEqual([
        expect.objectContaining({
          courseCode: "SF1625",
          courseName: "Calculus in One Variable",
          grade: "B",
        }),
      ]);
      expect(result.unmatched).toEqual([]);
    });

    it("is matched by its Swedish name", () => {
      const result = matchCandidates(
        [named("Envariabelanalys")],
        [
          course("SF1625", {
            titleEng: "Calculus in One Variable",
            titleSwe: "Envariabelanalys",
          }),
        ],
      );

      expect(result.matched.map((row) => row.courseCode)).toEqual(["SF1625"]);
    });

    it("ignores case, whitespace, punctuation and how 'and' is spelled", () => {
      const catalogue = [
        course("ME1003", { titleEng: "Industrial Management, Basic Course" }),
        course("DD1389", {
          titleEng: "Interactive Programming & Computer Games",
        }),
        course("SF1624", {
          titleEng: "Algebra and Geometry",
          titleSwe: "Algebra och geometri",
        }),
      ];

      const result = matchCandidates(
        [
          named("industrial  management -  basic course"),
          named("Interactive Programming and Computer Games"),
          named("Algebra & geometri"),
        ],
        catalogue,
      );

      expect(result.matched.map((row) => row.courseCode)).toEqual([
        "ME1003",
        "DD1389",
        "SF1624",
      ]);
    });

    it("settles a name several courses share by the credits the transcript printed", () => {
      const catalogue = [
        course("DD1337", { titleEng: "Programming", credits: 7 }),
        course("DD1310", { titleEng: "Programming", credits: 6 }),
      ];

      const result = matchCandidates(
        [named("Programming", { credits: 6 })],
        catalogue,
      );

      expect(result.matched.map((row) => row.courseCode)).toEqual(["DD1310"]);
      expect(result.unmatched).toEqual([]);
    });

    it("reports a shared name the credits do not settle rather than guessing", () => {
      const catalogue = [
        course("DD1337", { titleEng: "Programming", credits: 7.5 }),
        course("DD1310", { titleEng: "Programming", credits: 7.5 }),
      ];

      const result = matchCandidates(
        [
          named("Programming", { credits: 7.5 }),
          named("Programming", { credits: 9, completedOn: "2025-01-01" }),
        ],
        catalogue,
      );

      expect(result.matched).toEqual([]);
      expect(result.unmatched).toEqual([
        { courseCode: null, courseName: "Programming" },
      ]);
    });

    it("reports a name the catalogue does not have", () => {
      const result = matchCandidates(
        [named("Underwater Basket Weaving")],
        courses("SF1625"),
      );

      expect(result.matched).toEqual([]);
      expect(result.unmatched).toEqual([
        { courseCode: null, courseName: "Underwater Basket Weaving" },
      ]);
    });

    it("does not match on part of a name", () => {
      const result = matchCandidates(
        [named("Programming")],
        [course("DD1389", { titleEng: "Interactive Programming" })],
      );

      expect(result.matched).toEqual([]);
    });

    it("keeps one row per course, whether it was found by code or by name", () => {
      const result = matchCandidates(
        [
          candidate("SF1625", { grade: "C" }),
          named("Calculus in One Variable", { grade: "A" }),
        ],
        [course("SF1625", { titleEng: "Calculus in One Variable" })],
      );

      expect(result.matched).toHaveLength(1);
      expect(result.matched[0].grade).toBe("C");
    });

    it("counts a course once when both of its names point at it", () => {
      const result = matchCandidates(
        [named("Programming")],
        [
          course("DD1337", {
            titleEng: "Programming",
            titleSwe: "Programming",
          }),
        ],
      );

      expect(result.matched.map((row) => row.courseCode)).toEqual(["DD1337"]);
    });
  });
});

describe("normaliseCourseName", () => {
  it("folds case, whitespace, punctuation and the spellings of 'and'", () => {
    expect(normaliseCourseName("  Linjär Algebra,  Grundkurs ")).toBe(
      "linjär algebra grundkurs",
    );
    expect(normaliseCourseName("Theory & Practice")).toBe(
      normaliseCourseName("Theory and Practice"),
    );
    expect(normaliseCourseName("Teori och praktik")).toBe("teori and praktik");
  });
});
