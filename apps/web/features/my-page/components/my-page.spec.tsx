import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Review } from "@/types";
import { MyPage } from "./my-page";

const push = vi.fn();
const logout = vi.fn();
const deleteAccount = vi.fn();
const clearGrades = vi.fn();
const me = vi.fn();
const taken = vi.fn();
const reviews = vi.fn();
const tier = vi.fn();
const unreviewed = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("@/trpc/client", () => ({
  useTRPC: () => ({
    user: { me: { queryKey: () => ["user.me"] } },
    reviews: { list: { queryKey: () => ["reviews.list"] } },
    taken: { list: { queryKey: () => ["taken.list"] } },
  }),
}));

vi.mock("@/features/auth", () => ({
  useMe: () => me(),
  useRequireSession: () => ({}),
  useLogout: () => logout,
}));

vi.mock("@/lib/user", () => ({ uploadProfilePicture: vi.fn() }));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

vi.mock("../api/queries", () => ({
  useTakenCourses: () => taken(),
  useAllReviews: () => reviews(),
  useEffectiveTier: () => tier(),
  isTierUnavailable: () => false,
}));

vi.mock("../api/mutations", () => ({
  useDeleteAccount: () => ({ mutateAsync: deleteAccount, isPending: false }),
  useClearStoredGrades: () => ({ clearGrades, isPending: false }),
}));

/**
 * The reviews feature is stood in for so that this suite is about My Page: the
 * card and the prompt have their own specs, and the editor dialog drags a
 * rich-text editor in with it.
 */
vi.mock("@/features/reviews", () => ({
  useUnreviewedTakenCourses: () => unreviewed(),
  UnreviewedCard: ({
    courses,
    onStart,
    onSelect,
  }: {
    courses: { code: string }[];
    onStart: () => void;
    onSelect?: (code: string) => void;
  }) =>
    courses.length === 0 ? null : (
      <div data-testid="unreviewed">
        {courses.map((c) => c.code).join(",")}
        <button type="button" onClick={onStart}>
          Start reviewing
        </button>
        <button type="button" onClick={() => onSelect?.(courses[0].code)}>
          Pick a row
        </button>
      </div>
    ),
  ReviewCard: ({
    review,
    onDelete,
  }: {
    review: Review;
    onDelete?: () => void;
  }) => (
    <article>
      <span>{review.courseCode}</span>
      {onDelete ? (
        <button type="button" onClick={onDelete}>
          Delete review
        </button>
      ) : null}
    </article>
  ),
  Review: () => null,
  toEditableReview: (review: Review) => review,
  useRemoveReview: () => vi.fn(),
}));

function makeReview(overrides: Partial<Review>): Review {
  return {
    id: "r1",
    userId: "u1",
    courseCode: "DD1337",
    examinationDistribution: null,
    approachTheoryPercent: null,
    workloadScore: 6,
    learningScore: 7,
    happyTook: true,
    message: null,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    upvoteCount: 0,
    downvoteCount: 0,
    userVote: null,
    ...overrides,
  };
}

function takenCourse(overrides: Record<string, unknown> = {}) {
  return {
    courseCode: "DD1337",
    grade: null,
    earnedCredits: null,
    attendancePeriods: null,
    attendanceYear: null,
    transcriptImportedAt: null,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const settled = <T,>(data: T) => ({
  data,
  isPending: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
});

beforeEach(() => {
  me.mockReturnValue({
    user: {
      userId: "u1",
      name: "Elsa Lindqvist",
      email: "elsa@kth.se",
      image: null,
      savedCourseCodes: [],
    },
    isLoading: false,
    isAuthenticated: true,
    userId: "u1",
  });
  taken.mockReturnValue(settled([]));
  reviews.mockReturnValue(settled([]));
  tier.mockReturnValue({ data: 0, isError: false, error: null });
  unreviewed.mockReturnValue({
    courses: [],
    isLoading: false,
    isUnavailable: false,
  });
});

const openTab = (name: string | RegExp) =>
  userEvent.click(screen.getByRole("tab", { name }));

describe("MyPage tabs", () => {
  it("opens on Overview and offers all four sections", () => {
    render(<MyPage />);

    const tabs = within(
      screen.getByRole("tablist", { name: "My Page sections" }),
    );
    for (const label of ["Overview", "Reviews", "My dot", "Settings"]) {
      expect(tabs.getByRole("tab", { name: new RegExp(label) })).toBeVisible();
    }
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("Taken courses")).toBeVisible();
  });

  it("shows each tab's own content and only that", async () => {
    render(<MyPage />);

    await openTab(/^Reviews/);
    expect(screen.getByText("Your reviews")).toBeVisible();
    expect(screen.queryByText("Taken courses")).not.toBeInTheDocument();

    await openTab("My dot");
    expect(
      screen.getByRole("heading", { name: "Your node on the landing page" }),
    ).toBeVisible();
    expect(screen.queryByText("Your reviews")).not.toBeInTheDocument();

    await openTab("Settings");
    expect(
      screen.getByRole("heading", { name: "GPA and grades" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Your node on the landing page" }),
    ).not.toBeInTheDocument();
  });

  it("moves between tabs with the arrow keys", async () => {
    render(<MyPage />);

    screen.getByRole("tab", { name: "Overview" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByText("Your reviews")).toBeVisible();

    await userEvent.keyboard("{End}");
    expect(
      screen.getByRole("heading", { name: "GPA and grades" }),
    ).toBeVisible();

    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByText("Taken courses")).toBeVisible();
  });

  it("counts both review columns on the Reviews tab", () => {
    reviews.mockReturnValue(
      settled([
        makeReview({ id: "mine", userId: "u1" }),
        makeReview({ id: "theirs", userId: "u2", userVote: "up" }),
        makeReview({ id: "unvoted", userId: "u3" }),
      ]),
    );
    render(<MyPage />);

    expect(
      screen.getByRole("tab", { name: /^Reviews\s*,\s*2 in total$/ }),
    ).toBeVisible();
  });
});

describe("MyPage Overview", () => {
  it("counts taken courses, credits and reviews from the viewer's own rows", () => {
    taken.mockReturnValue(
      settled([
        takenCourse({ courseCode: "DD1337", earnedCredits: 9, grade: "A" }),
        takenCourse({ courseCode: "DD2380", earnedCredits: 6, grade: "C" }),
      ]),
    );
    reviews.mockReturnValue(
      settled([makeReview({ userId: "u1", upvoteCount: 3 })]),
    );
    render(<MyPage />);

    expect(screen.getByText("15.0")).toBeVisible();
    expect(screen.getByText("3 members found them helpful")).toBeVisible();
    // (5 * 9 + 3 * 6) / 15
    expect(screen.getByText("4.2")).toBeVisible();
  });

  it("counts a single upvote in the singular", () => {
    reviews.mockReturnValue(
      settled([makeReview({ userId: "u1", upvoteCount: 1 })]),
    );
    render(<MyPage />);

    expect(screen.getByText("1 member found them helpful")).toBeVisible();
  });

  it("says no grades are stored rather than showing a zero average", () => {
    taken.mockReturnValue(
      settled([takenCourse({ earnedCredits: 7.5, grade: null })]),
    );
    render(<MyPage />);

    expect(screen.getByText("no grades stored")).toBeVisible();
    expect(screen.queryByText("0.0")).not.toBeInTheDocument();
  });
});

describe("MyPage empty states", () => {
  it("offers the designed empty panel in both review columns", async () => {
    render(<MyPage />);
    await openTab(/^Reviews/);

    expect(screen.getByText("Nothing written yet")).toBeVisible();
    expect(screen.getByText("No upvoted reviews")).toBeVisible();

    await userEvent.click(
      screen.getByRole("button", { name: "Find a course to review" }),
    );
    expect(push).toHaveBeenCalledWith("/search");
  });

  it("draws no unreviewed prompt when every taken course has a review", () => {
    render(<MyPage />);
    expect(screen.queryByTestId("unreviewed")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/could not be worked out/),
    ).not.toBeInTheDocument();
  });

  it("holds the prompt's place while the unreviewed set is still unknown", () => {
    unreviewed.mockReturnValue({
      courses: [],
      isLoading: true,
      isUnavailable: false,
    });
    render(<MyPage />);

    // The stat cards are up, so a blank slot here would read as "nothing left
    // to review" rather than "still working it out".
    expect(screen.getByText("Taken courses")).toBeVisible();
    expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(
      0,
    );
  });

  /**
   * My Page has no reviewer of its own and should not grow one: `/taken` owns
   * the queue, and it is the screen that still knows which courses are
   * unreviewed by the time the reader arrives. Both the prompt's button and one
   * of its rows therefore go to the same place — the artboard's own
   * `window.location.href = "…Taken Courses…?review=1"`.
   */
  it("sends both the prompt's button and a row to the fast-track reviewer", async () => {
    unreviewed.mockReturnValue({
      courses: [takenCourse({ courseCode: "DD2380" })],
      isLoading: false,
      isUnavailable: false,
    });
    render(<MyPage />);

    await userEvent.click(
      screen.getByRole("button", { name: "Start reviewing" }),
    );
    expect(push).toHaveBeenCalledWith("/taken?review=1");

    push.mockClear();
    await userEvent.click(screen.getByRole("button", { name: "Pick a row" }));
    expect(push).toHaveBeenCalledWith("/taken?review=1");
  });
});

describe("MyPage privacy", () => {
  it("keeps the review count off the tab while the list is unread", () => {
    reviews.mockReturnValue({
      ...settled([makeReview({ userId: "u1" })]),
      isPending: true,
    });
    render(<MyPage />);

    expect(screen.getByRole("tab", { name: "Reviews" })).toBeVisible();
    expect(screen.queryByText(/in total/)).not.toBeInTheDocument();
  });

  it("keeps a cached review count off the tab once the read has failed", () => {
    // A failed query can still be holding what an earlier one returned, and
    // the panel below is saying the page did not load. A count beside that
    // would outlive the read it came from.
    reviews.mockReturnValue({
      ...settled([makeReview({ userId: "u1" }), makeReview({ id: "r2" })]),
      isError: true,
      error: new Error("nope"),
    });
    render(<MyPage />);

    expect(screen.getByText("Your page did not load")).toBeVisible();
    expect(screen.getByRole("tab", { name: "Reviews" })).toBeVisible();
    expect(screen.queryByText("2")).not.toBeInTheDocument();
    expect(screen.queryByText(/in total/)).not.toBeInTheDocument();
  });

  it("never says a review is signed", async () => {
    reviews.mockReturnValue(settled([makeReview({ userId: "u1" })]));
    render(<MyPage />);

    await openTab("Settings");
    expect(
      screen.getByText("Your reviews, with no name on them."),
    ).toBeVisible();
    expect(screen.queryByText(/signed/i)).not.toBeInTheDocument();
  });

  it("asks before deleting the account, and does not delete on the ask", async () => {
    render(<MyPage />);
    await openTab("Settings");

    await userEvent.click(
      screen.getByRole("button", { name: "Delete account" }),
    );
    expect(deleteAccount).not.toHaveBeenCalled();

    const dialog = within(screen.getByRole("alertdialog"));
    expect(dialog.getByText("Delete your account?")).toBeVisible();
    await userEvent.click(
      dialog.getByRole("button", { name: "Keep my account" }),
    );
    expect(deleteAccount).not.toHaveBeenCalled();
  });
});

describe("MyPage average preference", () => {
  const graded = [takenCourse({ earnedCredits: 6, grade: "A" })];

  beforeEach(() => {
    window.localStorage.clear();
    taken.mockReturnValue(settled(graded));
  });

  it("remembers the switch against the account, not the browser", async () => {
    render(<MyPage />);
    await openTab("Settings");

    await userEvent.click(
      screen.getByRole("switch", { name: "Calculate my average" }),
    );
    expect(window.localStorage.getItem("cc:myPage:showAverage:u1")).toBe(
      "false",
    );

    // Somebody else on the same browser starts from the default, not from the
    // answer the previous account gave about their own grades.
    cleanup();
    me.mockReturnValue({
      user: {
        userId: "u2",
        name: "Other Person",
        email: "other@kth.se",
        image: null,
        savedCourseCodes: [],
      },
      isLoading: false,
      isAuthenticated: true,
      userId: "u2",
    });
    render(<MyPage />);

    expect(screen.getByText("5.0")).toBeVisible();
  });
});

describe("MyPage my dot", () => {
  it("locks every tier at an effective tier of 0 and never says one was lost", async () => {
    render(<MyPage />);
    await openTab("My dot");

    expect(screen.getAllByText("Locked")).toHaveLength(3);
    expect(screen.queryByText("Unlocked")).not.toBeInTheDocument();
    expect(screen.queryByText(/dormant/i)).not.toBeInTheDocument();
  });

  it("names the six node colours once a colour tier is reached", async () => {
    tier.mockReturnValue({ data: 1, isError: false, error: null });
    render(<MyPage />);
    await openTab("My dot");

    for (const name of [
      "aurora",
      "ember",
      "frost",
      "moss",
      "slate",
      "violet",
    ]) {
      expect(screen.getByText(name)).toBeVisible();
    }
  });
});
