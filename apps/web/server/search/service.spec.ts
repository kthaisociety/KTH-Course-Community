import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CourseSummary } from "@/types";
import { embedSingle } from "../ai";
import { getSummariesByCodes } from "../course/service";
import {
  getAggregatesByCourseCodes,
  type ReviewAggregate,
} from "../reviews/service";
import { searchByEmbedding, searchByKeyword } from "./repository";
import { searchCourses } from "./service";

vi.mock("./repository");
vi.mock("../course/service");
vi.mock("../reviews/service");
vi.mock("../ai", () => ({
  embedSingle: vi.fn().mockRejectedValue(new Error("no embeddings in tests")),
}));

function summary(courseCode: string): CourseSummary {
  return {
    courseCode,
    titleEng: courseCode,
    currentStatus: "ESTABLISHED",
    credits: 7.5,
    creditUnit: "hp",
    department: "EECS",
    startTerms: [20252],
    examTypes: null,
    languages: ["English"],
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

/**
 * A reviewed course, described by the two 1-10 axes the filter can see. These
 * are raw aggregates straight from the database, deliberately unrounded.
 */
function reviewed(
  courseCode: string,
  workloadMean: number,
  learningMean: number,
): ReviewAggregate {
  return {
    courseCode,
    reviewCount: 10,
    happyCount: 5,
    workloadMean,
    learningMean,
    approachTheoryMean: null,
    approachTheoryAnswerCount: 0,
    examinationAnswerCount: 0,
    examinationMeans: null,
  };
}

describe("searchCourses minimum-rating filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(searchByKeyword).mockResolvedValue([
      { courseCode: "SF1625", score: 1 },
      { courseCode: "DD2421", score: 0.9 },
    ]);
    vi.mocked(getAggregatesByCourseCodes).mockResolvedValue([]);
    vi.mocked(getSummariesByCodes).mockImplementation(async (codes: string[]) =>
      codes.map(summary),
    );
  });

  it("rates a course on what reviewers learned, not on how hard they worked", async () => {
    // SF1625 is punishing and teaches little; DD2421 is gentle and teaches a
    // lot. Averaging workload in would rank them equally at 5.5.
    vi.mocked(getAggregatesByCourseCodes).mockResolvedValue([
      reviewed("SF1625", 10, 1),
      reviewed("DD2421", 1, 10),
    ]);

    const results = await searchCourses("maths", 10, { minRating: 4 });

    expect(results.map((r) => r.courseCode)).toEqual(["DD2421"]);
  });

  it("reads the star filter on its 1-5 scale, not the stored 1-10 one", async () => {
    // 4/10 learned is a poor course; a four-star filter must not return it.
    vi.mocked(getAggregatesByCourseCodes).mockResolvedValue([
      reviewed("SF1625", 5, 4),
      reviewed("DD2421", 5, 9),
    ]);

    const results = await searchCourses("maths", 10, { minRating: 4 });

    expect(results.map((r) => r.courseCode)).toEqual(["DD2421"]);
  });

  it("keeps a course whose stored score clears the converted threshold", async () => {
    vi.mocked(getAggregatesByCourseCodes).mockResolvedValue([
      reviewed("SF1625", 5, 6),
      reviewed("DD2421", 5, 5),
    ]);

    const results = await searchCourses("maths", 10, { minRating: 3 });

    expect(results.map((r) => r.courseCode)).toEqual(["SF1625"]);
  });

  it("filters on the raw mean, so a near miss is still a miss", async () => {
    // 5.99 is below a three-star threshold of 6. Rounded to the one decimal
    // the card displays it becomes 6.0 and would sneak through, so the filter
    // must read the aggregate rather than the card's numbers.
    vi.mocked(getAggregatesByCourseCodes).mockResolvedValue([
      reviewed("SF1625", 5, 5.99),
      reviewed("DD2421", 5, 6),
    ]);

    const results = await searchCourses("maths", 10, { minRating: 3 });

    expect(results.map((r) => r.courseCode)).toEqual(["DD2421"]);
  });

  it("drops an unreviewed course from a minimum-rating search", async () => {
    // No reviews is absent, not zero — but a course with no rating cannot
    // clear a minimum one either, so it is not in these results.
    vi.mocked(getAggregatesByCourseCodes).mockResolvedValue([
      reviewed("DD2421", 5, 8),
    ]);

    const results = await searchCourses("maths", 10, { minRating: 2 });

    expect(results.map((r) => r.courseCode)).toEqual(["DD2421"]);
  });

  it("does not filter when no minimum rating is asked for", async () => {
    const results = await searchCourses("maths", 10);

    expect(results.map((r) => r.courseCode)).toEqual(["SF1625", "DD2421"]);
    expect(getAggregatesByCourseCodes).not.toHaveBeenCalled();
  });

  it("keeps keyword order and appends only new semantic hits", async () => {
    vi.mocked(embedSingle).mockResolvedValueOnce({
      embedding: [0.25, 0.5],
      usage: { tokens: 2 },
    });
    vi.mocked(searchByKeyword).mockResolvedValueOnce([
      { courseCode: "SF1625", score: null },
      { courseCode: "DD2421", score: null },
    ]);
    vi.mocked(searchByEmbedding).mockResolvedValueOnce([
      { courseCode: "DD2421", score: 0.95 },
      { courseCode: "ID2209", score: 0.9 },
    ]);

    const results = await searchCourses("distributed systems", 3);

    expect(results.map((result) => result.courseCode)).toEqual([
      "SF1625",
      "DD2421",
      "ID2209",
    ]);
  });
});
