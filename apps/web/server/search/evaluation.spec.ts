import { describe, expect, it } from "vitest";
import {
  averageScoresByCategory,
  buildEvaluationQueries,
  parseGeneratedTopicQueries,
  rankTarget,
  reciprocalLogScore,
  sampleCourses,
  sampleCoursesStratified,
} from "./evaluation";

const course = {
  code: "DD2424",
  department: "EECS",
  titleEng: "Deep Learning in Data Science",
  titleSwe: "Djupinlärning i datavetenskap",
  goals:
    "After completing the course, students can explain neural networks and train machine learning models.",
  content: "Methods for image recognition and natural language processing.",
};

describe("search ranking evaluation helpers", () => {
  it("creates full-code, partial-code, shortened-title, and topic queries", () => {
    expect(
      buildEvaluationQueries(
        course,
        "Which course covers deep neural network architectures?",
      ),
    ).toEqual([
      {
        courseCode: "DD2424",
        courseTitle: "Deep Learning in Data Science",
        category: "code",
        query: "DD2424",
      },
      {
        courseCode: "DD2424",
        courseTitle: "Deep Learning in Data Science",
        category: "code",
        query: "DD24",
      },
      {
        courseCode: "DD2424",
        courseTitle: "Deep Learning in Data Science",
        category: "title",
        query: "Deep Learning",
      },
      {
        courseCode: "DD2424",
        courseTitle: "Deep Learning in Data Science",
        category: "topic",
        query: "Which course covers deep neural network architectures?",
      },
    ]);
  });

  it("samples the same courses for a fixed seed without mutating the catalogue", () => {
    const catalogue = ["A", "B", "C", "D", "E"];
    const first = sampleCourses(catalogue, 3, 417);

    expect(sampleCourses(catalogue, 3, 417)).toEqual(first);
    expect(sampleCourses(catalogue, 3, 418)).not.toEqual(first);
    expect(catalogue).toEqual(["A", "B", "C", "D", "E"]);
  });

  it("samples from every department with deterministic proportional quotas", () => {
    const catalogue = [
      { code: "A1", department: "A" },
      { code: "A2", department: "A" },
      { code: "A3", department: "A" },
      { code: "B1", department: "B" },
      { code: "B2", department: "B" },
      { code: "C1", department: "C" },
    ];
    const sample = sampleCoursesStratified(catalogue, 4, 417);

    expect(sampleCoursesStratified(catalogue, 4, 417)).toEqual(sample);
    expect(new Set(sample.map(({ department }) => department))).toEqual(
      new Set(["A", "B", "C"]),
    );
    expect(sample).toHaveLength(4);
  });

  it("rejects a sample too small to include every department", () => {
    expect(() =>
      sampleCoursesStratified(
        [{ department: "A" }, { department: "B" }, { department: "C" }],
        2,
        417,
      ),
    ).toThrow("Cannot include all 3 departments in a sample of 2");
  });

  it("uses a shortened contiguous phrase from the title", () => {
    const queries = buildEvaluationQueries(
      {
        ...course,
        titleEng: "Introduction to Machine Learning",
      },
      "Which course covers models?",
    );

    expect(queries.find((query) => query.category === "title")?.query).toBe(
      "Machine Learning",
    );
  });

  it("parses one generated topic query for each sampled course", () => {
    expect(
      parseGeneratedTopicQueries(
        JSON.stringify([
          { index: 1, query: "neural networks" },
          { index: 2, query: "probability models" },
        ]),
        [course, { ...course, code: "SF1918" }],
      ),
    ).toEqual(
      new Map([
        ["DD2424", "neural networks"],
        ["SF1918", "probability models"],
      ]),
    );
  });

  it("rejects incomplete topic-query output instead of silently scoring a fallback", () => {
    expect(() =>
      parseGeneratedTopicQueries(
        JSON.stringify([{ index: 1, query: "neural networks" }]),
        [course, { ...course, code: "SF1918" }],
      ),
    ).toThrow("Topic-query model omitted courses: SF1918");
  });

  it("scores ranks with reciprocal log base two and scores missing targets as zero", () => {
    expect(reciprocalLogScore(1)).toBe(1);
    expect(reciprocalLogScore(20)).toBeCloseTo(1 / Math.log2(21));
    expect(reciprocalLogScore(null)).toBe(0);
    expect(
      rankTarget("dd2424", [
        { courseCode: "SF1000" },
        { courseCode: "DD2424" },
      ]),
    ).toBe(2);
    expect(rankTarget("DD2424", [{ courseCode: "SF1000" }])).toBeNull();
  });

  it("averages each query category independently, including misses as zero", () => {
    const queries = buildEvaluationQueries(
      course,
      "Which course covers neural networks?",
    );
    const results = queries.map((query, index) => ({
      ...query,
      rank: index === 0 ? 1 : null,
      score: reciprocalLogScore(index === 0 ? 1 : null),
    }));

    expect(averageScoresByCategory(results)).toEqual({
      code: 0.5,
      title: 0,
      topic: 0,
    });
  });
});
