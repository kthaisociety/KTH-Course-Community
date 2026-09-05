import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUnreviewedTakenCourses } from "./queries";

/**
 * The hook is four queries joined into one answer, so the four are the seams
 * this suite works at: the session, `taken.list`, one `reviews.list` per taken
 * course, and one `course.summary` per course that survives the difference.
 * The difference itself is `selectUnreviewedCourses`, which has its own spec —
 * what is tested here is what the hook does around it.
 */

type QueryResult<T> = { data?: T; isPending: boolean; isError?: boolean };

const me = vi.fn();
const takenResult = vi.fn<() => QueryResult<{ courseCode: string }[]>>();
/** Keyed by course code, so a test can leave one list in flight. */
const reviewResults =
  vi.fn<
    () => Record<string, QueryResult<{ courseCode: string; userId: string }[]>>
  >();
const summaryFor = vi.fn<() => Record<string, string>>();

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => takenResult(),
  useQueries: ({ queries }: { queries: { input: { courseCode: string } }[] }) =>
    queries.map(
      (query) =>
        reviewResults()[query.input.courseCode] ?? {
          isPending: false,
          data: [],
        },
    ),
}));

// The tRPC proxy stands in as the thing that turns an input into query options;
// the mock above reads the input straight back off them.
vi.mock("@/trpc/client", () => ({
  useTRPC: () => ({
    taken: { list: { queryOptions: () => ({}) } },
    reviews: {
      list: { queryOptions: (input: { courseCode: string }) => ({ input }) },
    },
  }),
}));

vi.mock("@/features/auth", () => ({ useMe: () => me() }));

vi.mock("@/features/courses/api/queries", () => ({
  useCourseSummaries: (codes: string[]) =>
    codes.map((courseCode) => {
      const titleEng = summaryFor()[courseCode];
      return { data: titleEng ? { courseCode, titleEng } : undefined };
    }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  me.mockReturnValue({
    userId: "u1",
    isAuthenticated: true,
    isLoading: false,
  });
  takenResult.mockReturnValue({
    isPending: false,
    isError: false,
    data: [{ courseCode: "DD1337" }, { courseCode: "DD2380" }],
  });
  reviewResults.mockReturnValue({});
  summaryFor.mockReturnValue({
    DD1337: "Programming",
    DD2380: "Artificial Intelligence",
  });
});

describe("useUnreviewedTakenCourses", () => {
  it("names every course it returns", () => {
    const { result } = renderHook(() => useUnreviewedTakenCourses());

    expect(result.current.courses).toEqual([
      { courseCode: "DD1337", name: "Programming" },
      { courseCode: "DD2380", name: "Artificial Intelligence" },
    ]);
  });

  /**
   * A missing title is a worse row, not a wrong one — the card falls back to
   * the code — so nothing waits on `course.summary`. A missing review list is a
   * wrong row, and that one does hold the whole answer back.
   */
  it("returns the course with a null name rather than waiting for its title", () => {
    summaryFor.mockReturnValue({ DD1337: "Programming" });

    const { result } = renderHook(() => useUnreviewedTakenCourses());

    expect(result.current.courses).toEqual([
      { courseCode: "DD1337", name: "Programming" },
      { courseCode: "DD2380", name: null },
    ]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isUnavailable).toBe(false);
  });

  it("drops a course the viewer has already reviewed", () => {
    reviewResults.mockReturnValue({
      DD1337: {
        isPending: false,
        data: [{ courseCode: "DD1337", userId: "u1" }],
      },
    });

    const { result } = renderHook(() => useUnreviewedTakenCourses());

    expect(result.current.courses).toEqual([
      { courseCode: "DD2380", name: "Artificial Intelligence" },
    ]);
  });

  /** Somebody else's review leaves the course unreviewed *by you*. */
  it("keeps a course only somebody else reviewed", () => {
    reviewResults.mockReturnValue({
      DD1337: {
        isPending: false,
        data: [{ courseCode: "DD1337", userId: "u2" }],
      },
    });

    const { result } = renderHook(() => useUnreviewedTakenCourses());

    expect(result.current.courses.map((course) => course.courseCode)).toEqual([
      "DD1337",
      "DD2380",
    ]);
  });

  it("reports the set unavailable when a review list did not come back", () => {
    reviewResults.mockReturnValue({
      DD1337: { isPending: false, data: undefined },
    });

    const { result } = renderHook(() => useUnreviewedTakenCourses());

    expect(result.current.courses).toEqual([]);
    expect(result.current.isUnavailable).toBe(true);
  });

  it("is still loading while a review list is in flight", () => {
    reviewResults.mockReturnValue({ DD2380: { isPending: true } });

    const { result } = renderHook(() => useUnreviewedTakenCourses());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isUnavailable).toBe(false);
    expect(result.current.courses).toEqual([]);
  });
});
