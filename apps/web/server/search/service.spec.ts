import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CourseSummary } from "@/types";
import { embedSingle } from "../ai";
import { getSummariesByCodes } from "../course/service";
import { getAggregatesByCourseCodes } from "../reviews/service";
import { searchByEmbedding, searchByKeyword } from "./repository";
import { searchCourses } from "./service";

vi.mock("./repository");
vi.mock("../course/service");
// Search no longer imports the reviews domain at all. The mock stays so this
// suite can assert that: if the rating filter is ever reintroduced, the call
// comes back and the test below fails rather than silently passing.
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

describe("searchCourses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(searchByKeyword).mockResolvedValue([
      { courseCode: "SF1625", score: 1 },
      { courseCode: "DD2421", score: 0.9 },
    ]);
    vi.mocked(searchByEmbedding).mockResolvedValue([]);
    vi.mocked(getSummariesByCodes).mockImplementation(async (codes: string[]) =>
      codes.map(summary),
    );
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

  /**
   * The minimum-rating filter is gone, and with it the `size * 5` window that
   * existed only to leave something for a post-fetch pass to throw away.
   *
   * This asserts the window is not merely unused but absent: both legs are
   * asked for exactly `size`. An inflated fetch that nothing filters is a
   * five-fold cost on every search, and the slice would hide it from any test
   * that only looked at the returned codes.
   */
  it("fetches exactly the size it was asked for, on both legs", async () => {
    vi.mocked(embedSingle).mockResolvedValueOnce({
      embedding: [0.25, 0.5],
      usage: { tokens: 2 },
    });

    await searchCourses("maths", 4, { department: "EECS" });

    expect(searchByKeyword).toHaveBeenCalledWith("maths", 4, "EECS");
    expect(searchByEmbedding).toHaveBeenCalledWith([0.25, 0.5], 4, "EECS");
  });

  it("never reads review aggregates: rating is not a search filter", async () => {
    // The removed filter thresholded a learning mean it had to fetch from the
    // reviews domain, after the query, for every search that set it. Choosing
    // courses is now purely the catalogue's business.
    await searchCourses("maths", 10, { department: "EECS" });

    expect(getAggregatesByCourseCodes).not.toHaveBeenCalled();
  });

  it("returns nothing for a blank query without touching the database", async () => {
    const results = await searchCourses("   ", 10);

    expect(results).toEqual([]);
    expect(searchByKeyword).not.toHaveBeenCalled();
    expect(searchByEmbedding).not.toHaveBeenCalled();
  });

  it("returns every hit when no filter is given", async () => {
    const results = await searchCourses("maths", 10);

    expect(results.map((r) => r.courseCode)).toEqual(["SF1625", "DD2421"]);
  });
});
