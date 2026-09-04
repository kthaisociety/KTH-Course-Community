import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CourseReviewStats, CourseStats, CourseSummary } from "@/types";
import { getStatsByCodes, getSummariesByCodes } from "../course/service";
import { searchByKeyword } from "./repository";
import { searchCourses } from "./service";

vi.mock("./repository");
vi.mock("../course/service");
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

/** A reviewed course, described by the two 1-10 axes the filter can see. */
function reviewed(workloadMean: number, learningMean: number): CourseStats {
  return {
    reviews: {
      reviewCount: 10,
      happyCount: 5,
      happyPercent: 50,
      workloadMean,
      learningMean,
      approachTheoryPercent: null,
      approachTheoryAnswerCount: 0,
      examinationDistribution: null,
      examinationAnswerCount: 0,
      examLabel: null,
    } satisfies CourseReviewStats,
    takenCount: 0,
  };
}

const unreviewed: CourseStats = { reviews: null, takenCount: 0 };

function statsFor(byCode: Record<string, CourseStats>) {
  vi.mocked(getStatsByCodes).mockResolvedValue(new Map(Object.entries(byCode)));
}

describe("searchCourses minimum-rating filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(searchByKeyword).mockResolvedValue([
      { courseCode: "SF1625", score: 1 },
      { courseCode: "DD2421", score: 0.9 },
    ]);
    vi.mocked(getSummariesByCodes).mockImplementation(async (codes: string[]) =>
      codes.map(summary),
    );
  });

  it("rates a course on what reviewers learned, not on how hard they worked", async () => {
    // SF1625 is punishing and teaches little; DD2421 is gentle and teaches a
    // lot. Averaging workload in would rank them equally at 5.5.
    statsFor({
      SF1625: reviewed(10, 1),
      DD2421: reviewed(1, 10),
    });

    const results = await searchCourses("maths", 10, { minRating: 4 });

    expect(results.map((r) => r.courseCode)).toEqual(["DD2421"]);
  });

  it("reads the star filter on its 1-5 scale, not the stored 1-10 one", async () => {
    // 4/10 learned is a poor course; a four-star filter must not return it.
    statsFor({
      SF1625: reviewed(5, 4),
      DD2421: reviewed(5, 9),
    });

    const results = await searchCourses("maths", 10, { minRating: 4 });

    expect(results.map((r) => r.courseCode)).toEqual(["DD2421"]);
  });

  it("keeps a course whose stored score clears the converted threshold", async () => {
    statsFor({
      SF1625: reviewed(5, 6),
      DD2421: reviewed(5, 5),
    });

    const results = await searchCourses("maths", 10, { minRating: 3 });

    expect(results.map((r) => r.courseCode)).toEqual(["SF1625"]);
  });

  it("drops an unreviewed course from a minimum-rating search", async () => {
    // No reviews is absent, not zero — but a course with no rating cannot
    // clear a minimum one either, so it is not in these results.
    statsFor({ SF1625: unreviewed, DD2421: reviewed(5, 8) });

    const results = await searchCourses("maths", 10, { minRating: 2 });

    expect(results.map((r) => r.courseCode)).toEqual(["DD2421"]);
  });

  it("does not filter when no minimum rating is asked for", async () => {
    const results = await searchCourses("maths", 10);

    expect(results.map((r) => r.courseCode)).toEqual(["SF1625", "DD2421"]);
    expect(getStatsByCodes).not.toHaveBeenCalled();
  });
});
