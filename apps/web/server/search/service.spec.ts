import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CourseSummary } from "@/types";
import { getSummariesByCodes } from "../course/service";
import { averageRatings, searchByKeyword } from "./repository";
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

  it("reads the star filter on its 1-5 scale, not the stored 1-10 one", async () => {
    // 4/10 stored is a poor course; a four-star filter must not return it.
    vi.mocked(averageRatings).mockResolvedValue(
      new Map([
        ["SF1625", 4],
        ["DD2421", 9],
      ]),
    );

    const results = await searchCourses("maths", 10, { minRating: 4 });

    expect(results.map((r) => r.courseCode)).toEqual(["DD2421"]);
  });

  it("keeps a course whose stored score clears the converted threshold", async () => {
    vi.mocked(averageRatings).mockResolvedValue(
      new Map([
        ["SF1625", 6],
        ["DD2421", 5],
      ]),
    );

    const results = await searchCourses("maths", 10, { minRating: 3 });

    expect(results.map((r) => r.courseCode)).toEqual(["SF1625"]);
  });

  it("does not filter when no minimum rating is asked for", async () => {
    const results = await searchCourses("maths", 10);

    expect(results.map((r) => r.courseCode)).toEqual(["SF1625", "DD2421"]);
    expect(averageRatings).not.toHaveBeenCalled();
  });
});
