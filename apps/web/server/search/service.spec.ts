import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CourseSummary } from "@/types";
import { embedSingle } from "../ai";
import { getSummariesByCodes } from "../course/service";
import { getAggregatesByCourseCodes } from "../reviews/service";
import { searchByEmbedding, searchByKeyword } from "./repository";
import {
  DEFAULT_SEARCH_PAGE_SIZE,
  MAX_SEARCH_PAGES,
  searchCourses,
} from "./service";

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

/** `n` distinct hits, numbered so a slice is readable in a failure message. */
function hits(n: number, prefix = "C") {
  return Array.from({ length: n }, (_, i) => ({
    courseCode: `${prefix}${String(i).padStart(3, "0")}`,
    score: null,
  }));
}

/**
 * A keyword leg that behaves like the real one: one fixed ranking, cut to the
 * LIMIT it is handed. That prefix behaviour is the property the whole paging
 * scheme rests on, so the double has to have it or the tests below prove
 * nothing.
 */
function rankedKeywordLeg(ranking: ReturnType<typeof hits>) {
  vi.mocked(searchByKeyword).mockImplementation(async (_q, size) =>
    ranking.slice(0, size),
  );
}

function embeddingIsAvailable() {
  vi.mocked(embedSingle).mockResolvedValue({
    embedding: [0.25, 0.5],
    usage: { tokens: 2 },
  });
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
    embeddingIsAvailable();
    vi.mocked(searchByKeyword).mockResolvedValueOnce([
      { courseCode: "SF1625", score: null },
      { courseCode: "DD2421", score: null },
    ]);
    vi.mocked(searchByEmbedding).mockResolvedValueOnce([
      { courseCode: "DD2421", score: 0.95 },
      { courseCode: "ID2209", score: 0.9 },
    ]);

    const { results } = await searchCourses("distributed systems", { size: 3 });

    expect(results.map((result) => result.courseCode)).toEqual([
      "SF1625",
      "DD2421",
      "ID2209",
    ]);
  });

  it("never reads review aggregates: rating is not a search filter", async () => {
    // The removed filter thresholded a learning mean it had to fetch from the
    // reviews domain, after the query, for every search that set it. Choosing
    // courses is now purely the catalogue's business.
    await searchCourses("maths", { department: "EECS" });

    expect(getAggregatesByCourseCodes).not.toHaveBeenCalled();
  });

  it("returns nothing for a blank query without touching the database", async () => {
    const page = await searchCourses("   ");

    expect(page).toEqual({ results: [], page: 1, hasMore: false });
    expect(searchByKeyword).not.toHaveBeenCalled();
    expect(searchByEmbedding).not.toHaveBeenCalled();
  });

  it("returns every hit when no filter is given", async () => {
    const { results } = await searchCourses("maths");

    expect(results.map((r) => r.courseCode)).toEqual(["SF1625", "DD2421"]);
  });

  describe("the lookahead", () => {
    beforeEach(embeddingIsAvailable);

    /**
     * The window is `(page * size) + 1`, and the `+ 1` is the entire mechanism.
     * It is *one* row, not a multiple: the `size * 5` over-fetch that used to
     * feed a post-fetch rating filter is gone, and an inflated window
     * reintroduced here would cost every search and buy nothing.
     */
    it("asks each leg for one row more than the page needs", async () => {
      await searchCourses("maths", { page: 1, size: 20 });

      expect(searchByKeyword).toHaveBeenCalledWith("maths", 21, null);
      expect(searchByEmbedding).toHaveBeenCalledWith([0.25, 0.5], 21, null);
    });

    it("widens the window by whole pages, not by a multiple", async () => {
      await searchCourses("maths", { page: 3, size: 20 });

      expect(searchByKeyword).toHaveBeenCalledWith("maths", 61, null);
      expect(searchByEmbedding).toHaveBeenCalledWith([0.25, 0.5], 61, null);
    });

    it("reports a next page when the extra row comes back", async () => {
      rankedKeywordLeg(hits(41));

      const page = await searchCourses("maths", { page: 1, size: 20 });

      expect(page.hasMore).toBe(true);
      expect(page.results).toHaveLength(20);
    });

    it("reports no next page when it does not", async () => {
      rankedKeywordLeg(hits(20));

      const page = await searchCourses("maths", { page: 1, size: 20 });

      expect(page.hasMore).toBe(false);
      expect(page.results).toHaveLength(20);
    });

    /**
     * A full last page is the case a naive `results.length === size` check gets
     * wrong: twenty rows with nothing behind them look exactly like twenty rows
     * with more behind them. Only the extra row tells them apart.
     */
    it("does not offer a next page for a ranking ending exactly on the boundary", async () => {
      rankedKeywordLeg(hits(40));

      const second = await searchCourses("maths", { page: 2, size: 20 });

      expect(second.results).toHaveLength(20);
      expect(second.hasMore).toBe(false);
    });

    /**
     * `getSummariesByCodes` drops a code whose course row has gone, so a page
     * can come back shorter than the ranking behind it. "Is there another page"
     * is a fact about the ranking, not about how many summaries survived.
     */
    it("answers from the ranking, not from the rows that survived summary lookup", async () => {
      rankedKeywordLeg(hits(41));
      vi.mocked(getSummariesByCodes).mockImplementation(async (codes) =>
        codes.slice(0, 3).map(summary),
      );

      const page = await searchCourses("maths", { page: 1, size: 20 });

      expect(page.results).toHaveLength(3);
      expect(page.hasMore).toBe(true);
    });
  });

  describe("the page it serves", () => {
    beforeEach(embeddingIsAvailable);

    it("slices the requested page out of the ranking", async () => {
      const ranking = hits(60);
      rankedKeywordLeg(ranking);

      const second = await searchCourses("maths", { page: 2, size: 20 });

      expect(second.page).toBe(2);
      expect(second.results.map((r) => r.courseCode)).toEqual(
        ranking.slice(20, 40).map((h) => h.courseCode),
      );
    });

    /**
     * The property the whole scheme rests on: a wider fetch yields the same
     * page. Each leg is a LIMIT over a totally ordered query — which is why
     * `searchByEmbedding` had to grow `courses.code ASC` — so a wider LIMIT is
     * a superset beginning with the narrower one, and the union of the two legs
     * inherits that.
     */
    it("gives the same page whatever depth the fetch went to", async () => {
      const keyword = hits(30, "K");
      const semantic = hits(30, "S");
      vi.mocked(searchByKeyword).mockImplementation(async (_q, size) =>
        keyword.slice(0, size),
      );
      vi.mocked(searchByEmbedding).mockImplementation(async (_e, size) =>
        semantic.slice(0, size),
      );

      const asPage2 = await searchCourses("maths", { page: 2, size: 5 });
      const asPage4 = await searchCourses("maths", { page: 4, size: 5 });
      const wholePrefix = await searchCourses("maths", { page: 1, size: 20 });

      const codes = wholePrefix.results.map((r) => r.courseCode);
      expect(asPage2.results.map((r) => r.courseCode)).toEqual(
        codes.slice(5, 10),
      );
      expect(asPage4.results.map((r) => r.courseCode)).toEqual(
        codes.slice(15, 20),
      );
    });

    it("keeps the department filter on every page, in SQL", async () => {
      rankedKeywordLeg(hits(60));

      await searchCourses("maths", { page: 3, size: 20, department: "EECS" });

      expect(searchByKeyword).toHaveBeenCalledWith("maths", 61, "EECS");
      expect(searchByEmbedding).toHaveBeenCalledWith([0.25, 0.5], 61, "EECS");
    });

    it("returns an empty page, not an error, past the end of a short ranking", async () => {
      rankedKeywordLeg(hits(25));

      const page = await searchCourses("maths", { page: 3, size: 20 });

      expect(page).toEqual({ results: [], page: 3, hasMore: false });
      expect(getSummariesByCodes).not.toHaveBeenCalled();
    });
  });

  describe("the depth cap", () => {
    beforeEach(embeddingIsAvailable);

    /**
     * `MAX_SEARCH_PAGES` is a judgement, not a fact about the data: the
     * semantic leg has no relevance floor, so a deep page is courses sorted by
     * how little they match. Past the cap there is no next page to ask about,
     * so the extra row is not even fetched.
     */
    it("stops offering a next page at the last page it allows", async () => {
      rankedKeywordLeg(hits(500));

      const last = await searchCourses("maths", {
        page: MAX_SEARCH_PAGES,
        size: 20,
      });

      expect(last.results).toHaveLength(20);
      expect(last.hasMore).toBe(false);
      expect(searchByKeyword).toHaveBeenCalledWith(
        "maths",
        MAX_SEARCH_PAGES * 20,
        null,
      );
    });

    it("clamps a page past the cap onto the last one, and says which it served", async () => {
      rankedKeywordLeg(hits(500));

      const page = await searchCourses("maths", { page: 99, size: 20 });

      expect(page.page).toBe(MAX_SEARCH_PAGES);
      expect(page.hasMore).toBe(false);
      expect(searchByKeyword).toHaveBeenCalledWith(
        "maths",
        MAX_SEARCH_PAGES * 20,
        null,
      );
    });

    it.each([0, -3, Number.NaN, 1.7])(
      "treats %p as the first page",
      async (page) => {
        rankedKeywordLeg(hits(60));

        const served = await searchCourses("maths", { page, size: 20 });

        expect(served.page).toBe(1);
        expect(searchByKeyword).toHaveBeenCalledWith("maths", 21, null);
      },
    );

    it("bounds the deepest possible fetch to the cap times the page size", async () => {
      rankedKeywordLeg(hits(5000));

      await searchCourses("maths", {
        page: 10_000,
        size: DEFAULT_SEARCH_PAGE_SIZE,
      });

      const fetchWindow = vi.mocked(searchByKeyword).mock.calls[0]?.[1];
      expect(fetchWindow).toBe(MAX_SEARCH_PAGES * DEFAULT_SEARCH_PAGE_SIZE);
    });
  });

  it("defaults to a page of 20", async () => {
    embeddingIsAvailable();
    rankedKeywordLeg(hits(100));

    const page = await searchCourses("maths");

    expect(DEFAULT_SEARCH_PAGE_SIZE).toBe(20);
    expect(page.results).toHaveLength(DEFAULT_SEARCH_PAGE_SIZE);
    expect(searchByKeyword).toHaveBeenCalledWith(
      "maths",
      DEFAULT_SEARCH_PAGE_SIZE + 1,
      null,
    );
  });
});
