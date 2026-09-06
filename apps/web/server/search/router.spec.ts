import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCallerFactory } from "../api/trpc";
import { searchRouter } from "./router";
import {
  DEFAULT_SEARCH_PAGE_SIZE,
  getDepartments,
  searchCourses,
} from "./service";

vi.mock("./service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./service")>();
  return {
    ...actual,
    searchCourses: vi.fn(),
    getDepartments: vi.fn(),
  };
});

/** Search is open to visitors: every case here is an anonymous caller. */
function caller() {
  return createCallerFactory(searchRouter)({
    session: null as never,
    headers: new Headers(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(searchCourses).mockResolvedValue({
    results: [],
    page: 1,
    hasMore: false,
  });
  vi.mocked(getDepartments).mockResolvedValue(["EECS"]);
});

describe("search.courses", () => {
  /**
   * `total` was `results.length` — the size of the page just built, offered as
   * if it were the size of the matching set. It is not replaced by a truthful
   * count: a de-duplicated union of a keyword ranking and a semantic one has no
   * count to take, and the semantic leg matches every course with an embedding
   * at some distance. `hasMore` is what a prev/next pager actually asks (#148).
   */
  it("reports whether there is another page, and no total at all", async () => {
    vi.mocked(searchCourses).mockResolvedValue({
      results: [],
      page: 2,
      hasMore: true,
    });

    const reply = await caller().courses({ q: "maths", page: 2 });

    expect(reply).toEqual({
      results: [],
      page: 2,
      pageSize: DEFAULT_SEARCH_PAGE_SIZE,
      hasMore: true,
    });
    expect(reply).not.toHaveProperty("total");
  });

  it("honours the page it is given rather than accepting and dropping it", async () => {
    await caller().courses({ q: "maths", page: 3, department: "EECS" });

    expect(searchCourses).toHaveBeenCalledWith("maths", {
      page: 3,
      size: DEFAULT_SEARCH_PAGE_SIZE,
      department: "EECS",
    });
  });

  /**
   * The page in the reply is the service's, not the input's: it clamps to the
   * depth cap, so a hand-typed `?page=99` is served as the last page that
   * exists and the reply says which one that was.
   */
  it("echoes the page that was served, not the page that was asked for", async () => {
    vi.mocked(searchCourses).mockResolvedValue({
      results: [],
      page: 5,
      hasMore: false,
    });

    const reply = await caller().courses({ q: "maths", page: 99 });

    expect(reply.page).toBe(5);
  });

  it("defaults to a page of 20, replacing the old 10", async () => {
    await caller().courses({ q: "maths" });

    expect(DEFAULT_SEARCH_PAGE_SIZE).toBe(20);
    expect(searchCourses).toHaveBeenCalledWith("maths", {
      page: undefined,
      size: 20,
      department: undefined,
    });
  });

  /**
   * This procedure is open to visitors and the window it fetches is
   * `page * size`, so an uncapped `size` would be a lever on the cost of an
   * anonymous request — five pages deep at whatever width the caller liked.
   * A smaller page is still allowed; a larger one is not a page.
   */
  it("refuses a page size larger than the default", async () => {
    await expect(
      caller().courses({ q: "maths", size: 5_000 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(searchCourses).not.toHaveBeenCalled();

    await expect(caller().courses({ q: "maths", size: 5 })).resolves.toEqual(
      expect.objectContaining({ pageSize: 5 }),
    );
  });

  it("refuses a page that is not a page", async () => {
    await expect(
      caller().courses({ q: "maths", page: 0 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller().courses({ q: "maths", page: -2 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
