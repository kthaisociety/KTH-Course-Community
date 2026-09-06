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
const personalization = vi.fn();
const setAppearance = vi.fn();
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
  useLogout: () => logout,
  authHref: (to: string) => `/auth?next=${encodeURIComponent(to)}`,
}));

vi.mock("@/lib/user", () => ({ uploadProfilePicture: vi.fn() }));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

vi.mock("../api/queries", () => ({
  useTakenCourses: () => taken(),
  useAllReviews: () => reviews(),
  useNodePersonalization: () => personalization(),
  isTierUnavailable: () => false,
}));

vi.mock("../api/mutations", () => ({
  useDeleteAccount: () => ({ mutateAsync: deleteAccount, isPending: false }),
  useClearStoredGrades: () => ({ clearGrades, isPending: false }),
  useSetNodeAppearance: () => ({
    mutate: setAppearance,
    isPending: false,
    isError: false,
  }),
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
    // The real card falls back to the code when it has no name, so the stub
    // renders both — a row that renders its code twice is the second half of
    // #157 and has to be visible to a test.
    courses: { code: string; name?: string | null }[];
    onStart: () => void;
    onSelect?: (code: string) => void;
  }) =>
    courses.length === 0 ? null : (
      <div data-testid="unreviewed">
        {courses.map((c) => `${c.code} ${c.name || c.code}`).join(", ")}
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
  setAppearance.mockClear();
  personalization.mockReturnValue(
    personalizationState({ earnedTier: 0, effectiveTier: 0 }),
  );
  unreviewed.mockReturnValue({
    courses: [],
    isLoading: false,
    isUnavailable: false,
  });
});

/**
 * `graph.personalization` as My Page reads it: two tier numbers and the stored
 * appearance. Both numbers matter — the effective one says what may be edited,
 * the earned one is what tells a dormant axis from a locked one.
 */
function personalizationState(over: {
  earnedTier: number;
  effectiveTier: number;
  appearance?: { color: string; style: string; signalStyle: string };
}) {
  return {
    data: {
      earnedTier: over.earnedTier,
      effectiveTier: over.effectiveTier,
      appearance: over.appearance ?? {
        color: "default",
        style: "default",
        signalStyle: "default",
      },
    },
    isError: false,
    error: null,
  };
}

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
   * of its rows therefore go there — the artboard's own
   * `window.location.href = "…Taken Courses…?review=1"`.
   *
   * They do not go to the *same* place. The button names no course and writes
   * the original flag; a row names one and the URL carries it, which is the
   * whole point of #157 — the row used to discard the course it named.
   */
  it("sends the prompt's button to a whole round and a row to its own course", async () => {
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
    expect(push).toHaveBeenCalledWith("/taken?review=DD2380");
  });

  /**
   * `user_taken_courses` stores only a code, so a row with no name renders the
   * code twice (#157's second defect). The title now comes back on the course
   * from `useUnreviewedTakenCourses`, and My Page has only to pass it on.
   */
  it("hands the card the catalogue title the hook looked up", async () => {
    unreviewed.mockReturnValue({
      courses: [
        {
          ...takenCourse({ courseCode: "DD2380" }),
          name: "Artificial Intelligence",
        },
      ],
      isLoading: false,
      isUnavailable: false,
    });
    render(<MyPage />);

    expect(screen.getByTestId("unreviewed")).toHaveTextContent(
      "DD2380 Artificial Intelligence",
    );
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
    expect(screen.queryByText("Dormant")).not.toBeInTheDocument();
  });

  it("names the six node colours once a colour tier is reached", async () => {
    personalization.mockReturnValue(
      personalizationState({ earnedTier: 1, effectiveTier: 1 }),
    );
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
      expect(screen.getByRole("button", { name })).toBeVisible();
    }
  });

  /**
   * The palette used to be shown rather than offered, because nothing wrote
   * `users_node_profiles`. It is a write now, and the click is the whole
   * feature: this is the test that fails if the buttons go inert again.
   */
  it("writes the colour a member clicks, and only that axis", async () => {
    personalization.mockReturnValue(
      personalizationState({ earnedTier: 1, effectiveTier: 1 }),
    );
    render(<MyPage />);
    await openTab("My dot");

    await userEvent.click(screen.getByRole("button", { name: "ember" }));

    expect(setAppearance).toHaveBeenCalledWith({ color: "ember" });
  });

  // The highlight is what the server last confirmed, never what was clicked:
  // nothing here paints optimistically, because the tier gate can refuse.
  it("marks the stored pick as the pressed option", async () => {
    personalization.mockReturnValue(
      personalizationState({
        earnedTier: 1,
        effectiveTier: 1,
        appearance: { color: "moss", style: "default", signalStyle: "default" },
      }),
    );
    render(<MyPage />);
    await openTab("My dot");

    expect(screen.getByRole("button", { name: "moss" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "ember" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("offers the three shapes and the three signals at the top of the ladder", async () => {
    personalization.mockReturnValue(
      personalizationState({ earnedTier: 3, effectiveTier: 3 }),
    );
    render(<MyPage />);
    await openTab("My dot");

    for (const name of [
      "solid",
      "ring",
      "diamond",
      "fade",
      "comet",
      "dashed",
    ]) {
      expect(screen.getByRole("button", { name })).toBeVisible();
    }
    expect(screen.getAllByText("Unlocked")).toHaveLength(3);
  });

  /**
   * The third badge, and the reason the read returns two numbers. Somebody who
   * reached tier 3 and went quiet has earned every axis and can edit none of
   * them; "Locked" there would tell them they had lost something the column
   * still holds.
   */
  it("calls an earned axis that has decayed dormant, not locked", async () => {
    personalization.mockReturnValue(
      personalizationState({
        earnedTier: 3,
        effectiveTier: 1,
        appearance: {
          color: "violet",
          style: "diamond",
          signalStyle: "comet",
        },
      }),
    );
    render(<MyPage />);
    await openTab("My dot");

    expect(screen.getAllByText("Dormant")).toHaveLength(2);
    expect(screen.getAllByText("Unlocked")).toHaveLength(1);
    expect(screen.queryByText("Locked")).not.toBeInTheDocument();
  });

  // A dormant axis names what it is holding, because "reviewing again restores
  // them" is otherwise unverifiable from the one screen that claims it.
  it("names the pick a dormant axis is still holding", async () => {
    personalization.mockReturnValue(
      personalizationState({
        earnedTier: 3,
        effectiveTier: 1,
        appearance: {
          color: "violet",
          style: "diamond",
          signalStyle: "comet",
        },
      }),
    );
    render(<MyPage />);
    await openTab("My dot");

    expect(screen.getByText("diamond")).toBeVisible();
    expect(screen.getByText("comet")).toBeVisible();
    // Named, not offered: a dormant axis cannot be clicked.
    expect(
      screen.queryByRole("button", { name: "diamond" }),
    ).not.toBeInTheDocument();
  });

  it("offers nothing at all on an axis that was never earned", async () => {
    personalization.mockReturnValue(
      personalizationState({ earnedTier: 1, effectiveTier: 1 }),
    );
    render(<MyPage />);
    await openTab("My dot");

    expect(
      screen.queryByRole("button", { name: "diamond" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "comet" }),
    ).not.toBeInTheDocument();
  });

  /**
   * The signed-out panel, which `My Page.dc.html:73-90` draws inside the shell
   * rather than as a redirect. It was unreachable until `/profile` stopped
   * being redirected away and this page stopped calling `useRequireSession`.
   */
  describe("a guest", () => {
    beforeEach(() => {
      me.mockReturnValue({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        userId: "",
      });
    });

    it("gets the artboard's panel in place, not a redirect", () => {
      render(<MyPage />);

      expect(screen.getByText("Sign in to see your page")).toBeVisible();
      // The page renders the state rather than navigating out of it.
      expect(push).not.toHaveBeenCalled();
    });

    it("is offered both ways in, as the artboard draws them", () => {
      render(<MyPage />);

      expect(screen.getByRole("link", { name: "Sign up" })).toBeVisible();
      expect(screen.getByRole("link", { name: "Log in" })).toBeVisible();
    });

    // Signing in from here comes back here. A bare `/auth` would land them on
    // `/search`, having asked for their own page.
    it("comes back to this page after signing in", () => {
      render(<MyPage />);

      for (const name of ["Sign up", "Log in"]) {
        expect(screen.getByRole("link", { name })).toHaveAttribute(
          "href",
          "/auth?next=%2Fprofile",
        );
      }
    });

    it("does not ask for anything the reader has no account for", () => {
      render(<MyPage />);

      expect(screen.queryByRole("tab", { name: "Overview" })).toBeNull();
    });
  });
});
