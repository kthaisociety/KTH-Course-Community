import { describe, expect, it } from "vitest";
import { loadCorpusFixture } from "./corpus";

const corpus = loadCorpusFixture();

// A Swedish letter stored as a numeric entity, e.g. "genomg&#229;ngen".
const SWEDISH_ENTITY = /&#(229|228|246|197|196|214);/;
// Every KTH course code in the corpus fits this one shape — see the census.
const COURSE_CODE = /\b[A-Z]{2}[0-9]{3,4}[A-Z]?\b/g;

const countCodes = (eligibility: string) =>
  eligibility.replace(/<[^>]*>/g, " ").match(COURSE_CODE)?.length ?? 0;

describe("corpus fixture", () => {
  it("loads 300 courses with unique codes", () => {
    expect(corpus).toHaveLength(300);
    expect(new Set(corpus.map((course) => course.code)).size).toBe(300);
  });

  it("covers every department in the catalogue", () => {
    // The census counted 100 distinct department codes across all 4644 rows.
    expect(new Set(corpus.map((course) => course.departmentCode)).size).toBe(
      100,
    );
  });

  it("keeps the prose verbatim rather than cleaned", () => {
    const withTags = corpus.filter((course) => course.goals.includes("<p>"));
    expect(withTags.length).toBeGreaterThan(200);
    const withEntities = corpus.filter((course) =>
      SWEDISH_ENTITY.test(course.goals),
    );
    expect(withEntities.length).toBeGreaterThan(150);
  });

  it("carries enough English prose to iterate a prompt on", () => {
    // Swedish syllabus prose effectively always contains å, ä or ö, so its
    // absence is a cheap deterministic proxy for an English row.
    const english = corpus.filter(
      (course) => course.goals !== "" && !SWEDISH_ENTITY.test(course.goals),
    );
    expect(english.length).toBeGreaterThanOrEqual(40);
  });

  it("carries the rows that break a naive derive pass", () => {
    const noProse = corpus.filter(
      (course) => course.goals === "" && course.content === "",
    );
    const noEligibility = corpus.filter((course) => course.eligibility === "");
    const codeHeavy = corpus.filter(
      (course) => countCodes(course.eligibility) >= 5,
    );
    const terse = corpus.filter(
      (course) =>
        course.eligibility !== "" &&
        course.eligibility.replace(/<[^>]*>/g, "").trim().length <= 40,
    );

    expect(noProse.length).toBeGreaterThanOrEqual(12);
    expect(noEligibility.length).toBeGreaterThanOrEqual(12);
    expect(codeHeavy.length).toBeGreaterThanOrEqual(20);
    expect(terse.length).toBeGreaterThanOrEqual(20);
  });
});
