import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CourseDetails, CourseStats } from "@/types";
import type { OpenCourse } from "../lib/open-courses";
import { WorkspacePane } from "./workspace-pane";

const useCourseDetails = vi.fn();
const useCourseSummaries = vi.fn();
const useReviewList = vi.fn();
const addReview = vi.fn();
const useMe = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { signIn: { social: vi.fn() } },
}));

vi.mock("@/features/courses", () => ({
  useCourseDetails: (code: string) => useCourseDetails(code),
  useCourseSummaries: (codes: string[]) => useCourseSummaries(codes),
}));

// `ReviewList` is the reviews feature's own list of designed Review Cards
// (#87). The pane's job is to hand it the course and its reviews, which is
// what this asserts; how a card draws itself is that feature's test.
// The palette is the real one — the pane draws the same examination bar the
// Review Card does. The barrel itself is not imported: it reaches the rich
// text editor, whose stylesheet needs a PostCSS pass Vitest does not run.
vi.mock("@/features/reviews", async () => ({
  ...(await import("@/features/reviews/lib/examination-palette")),
  useReviewList: (code: string | undefined) => useReviewList(code),
  useAddReview: () => addReview,
  ReviewList: ({
    courseCode,
    reviews,
  }: {
    courseCode: string;
    reviews: { id: string }[];
  }) => (
    <div data-testid="review-list" data-course={courseCode}>
      {reviews.map((review) => (
        <article key={review.id} data-testid="review-card">
          {review.id}
        </article>
      ))}
    </div>
  ),
}));

// Only the session is faked; AuthReasonDialog stays real, because "a visitor is
// asked to sign in before publishing" is the state under test.
vi.mock("@/features/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/auth")>()),
  useMe: () => useMe(),
}));

const DETAILS: CourseDetails = {
  courseCode: "DD2380",
  titleEng: "Artificial Intelligence",
  titleSwe: "Artificiell intelligens",
  department: "EECS",
  departmentCode: "JJ",
  credits: 6,
  creditUnit: "hp",
  educationalLevel: "ADVANCED",
  gradeScale: "AF",
  goals: null,
  content: "<p>Search, planning and machine learning.</p>",
  eligibility: null,
  rounds: [
    {
      startTerm: 20252,
      formattedPeriodsAndCredits: "P2 (6,0 hp)",
      studyPace: 50,
      language: "English",
      tutoringForm: "Normal",
      tutoringTime: "DAG",
      isProgrammeCourse: true,
      schemaURL: null,
    },
  ],
  examinations: [],
};

const REVIEWED: CourseStats = {
  takenCount: 12,
  reviews: {
    reviewCount: 4,
    happyCount: 3,
    happyPercent: 75,
    workloadMean: 7.6,
    learningMean: 8.2,
    approachTheoryPercent: 70,
    approachTheoryAnswerCount: 3,
    examinationDistribution: {
      exam: 60,
      assignments: 0,
      labs: 40,
      projects: 0,
      seminars: 0,
      other: 0,
    },
    examinationAnswerCount: 3,
    examLabel: "Exam 60% · Labs 40%",
  },
};

const UNREVIEWED: CourseStats = { takenCount: 0, reviews: null };

function openCourse(kind: OpenCourse["kind"], code = "DD2380"): OpenCourse {
  return { id: `${kind}:${code}`, courseCode: code, kind };
}

type ReviewRow = { id: string; courseCode: string; userId?: string };

/**
 * What a `reviews.list` refetch would answer with, which is a separate thing
 * from what the panel has in hand.
 *
 * The panel confirms a publication by asking the list again — a request it
 * starts itself, so it is known to have begun after the write. These stand in
 * for the server's answer to that request: `reviewListNow` is what the next
 * refetch resolves with, `reviewListStaysPending` never answers, and
 * `reviewListRefetchFails` answers with a failure.
 */
type RefetchAnswer = () => Promise<{ isSuccess: boolean; data: ReviewRow[] }>;

let refetchAnswer: RefetchAnswer = () =>
  Promise.resolve({ isSuccess: true, data: [] });

function reviewListNow(rows: ReviewRow[]) {
  refetchAnswer = () => Promise.resolve({ isSuccess: true, data: rows });
}

function reviewListStaysPending() {
  refetchAnswer = () => new Promise(() => {});
}

function reviewListRefetchFails() {
  refetchAnswer = () => Promise.resolve({ isSuccess: false, data: [] });
}

/** `reviews.list` as the panel reads it: what is there, and whether it is sure. */
function setReviewList(rows: ReviewRow[], over: Record<string, unknown> = {}) {
  reviewListNow(rows);
  useReviewList.mockReturnValue({
    data: rows,
    isLoading: false,
    isFetching: false,
    isSuccess: true,
    isError: false,
    refetch: () => refetchAnswer(),
    ...over,
  });
}

function setStats(stats: CourseStats) {
  useCourseSummaries.mockReturnValue([
    {
      data: { courseCode: "DD2380", stats },
      isSuccess: true,
      isError: false,
    },
  ]);
}

/** The summary is its own request and can still be in flight, or fail. */
function setStatsUnanswered(over: Record<string, unknown> = {}) {
  useCourseSummaries.mockReturnValue([
    { data: undefined, isSuccess: false, isError: false, ...over },
  ]);
}

function renderPane(
  open: OpenCourse[],
  over: Partial<React.ComponentProps<typeof WorkspacePane>> = {},
) {
  const props = {
    openCourses: open,
    activeId: open[0]?.id ?? null,
    onActivate: vi.fn(),
    onClose: vi.fn(),
    onOpen: vi.fn(),
    ...over,
  };
  return { ...render(<WorkspacePane {...props} />), props };
}

beforeEach(() => {
  sessionStorage.clear();
  useCourseDetails.mockReturnValue({
    data: DETAILS,
    isLoading: false,
    error: null,
  });
  setStats(REVIEWED);
  setReviewList([]);
  useMe.mockReturnValue({
    isAuthenticated: true,
    isLoading: false,
    userId: "u1",
  });
  addReview.mockResolvedValue(true);
});

describe("WorkspacePane", () => {
  it("shows nothing when no course is open", () => {
    const { container } = renderPane([]);

    expect(container).toBeEmptyDOMElement();
  });

  it("gives every open course a tab and closes the one in front", async () => {
    const user = userEvent.setup({ delay: null });
    const { props } = renderPane([
      openCourse("details"),
      openCourse("review", "SF1626"),
    ]);

    expect(
      screen.getByRole("button", { name: "DD2380 · Details" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "SF1626 · Review draft" }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "SF1626 · Review draft" }),
    );
    expect(props.onActivate).toHaveBeenCalledWith("review:SF1626");

    await user.click(
      screen.getByRole("button", { name: "Close DD2380 · Details" }),
    );
    expect(props.onClose).toHaveBeenCalledWith("details:DD2380");
  });

  it("lists every open course in the switcher, whatever the tabs can fit", async () => {
    const user = userEvent.setup({ delay: null });
    const codes = ["DD2380", "SF1626", "DH2642", "DD1337", "SF1625", "DD2434"];
    renderPane(codes.map((code) => openCourse("details", code)));

    await user.click(screen.getByRole("button", { name: "All open panes" }));

    const menu = screen.getByRole("menu");
    for (const code of codes) {
      expect(
        within(menu).getByRole("menuitem", { name: `${code} · Details` }),
      ).toBeInTheDocument();
    }
  });

  it("drops the tab strip when the host owns the switcher", () => {
    renderPane([openCourse("details")], { hideTabs: true });

    expect(
      screen.queryByRole("button", { name: "All open panes" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Artificial Intelligence")).toBeInTheDocument();
  });

  it("still says which of the two things a sheet opened to", () => {
    // The mobile sheet hides the strip, so the header is the only thing left
    // saying whether this course opened to its details or to a review draft.
    const { unmount } = renderPane([openCourse("details")], {
      hideTabs: true,
    });
    expect(screen.getByText("Course details")).toBeInTheDocument();
    unmount();

    renderPane([openCourse("review")], { hideTabs: true });
    expect(screen.getByText("Review draft")).toBeInTheDocument();
  });
});

describe("the details tab", () => {
  it("renders the catalogue entry and its offerings", () => {
    renderPane([openCourse("details")]);

    expect(screen.getByText("Artificial Intelligence")).toBeInTheDocument();
    expect(screen.getByText(/6 hp · DD2380 · EECS/)).toBeInTheDocument();
    expect(screen.getByText(/P2 \(6,0 hp\)/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Open on KTH.se/ }),
    ).toHaveAttribute("href", "https://www.kth.se/student/kurser/kurs/DD2380");
  });

  it("renders the review means raw on the 1-10 scale", () => {
    renderPane([openCourse("details")]);

    expect(screen.getByText("7.6 / 10")).toBeInTheDocument();
    expect(screen.getByText("8.2 / 10")).toBeInTheDocument();
    expect(screen.getByText("60 / 40")).toBeInTheDocument();
    expect(screen.getByText("Exam · Labs")).toBeInTheDocument();
  });

  it("says a course has no reviews rather than scoring it zero", () => {
    setStats(UNREVIEWED);
    renderPane([openCourse("details")]);

    expect(
      screen.getByText("No reviews yet — be the first to write one."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/\/ 10$/)).not.toBeInTheDocument();
  });

  it("does not call a course unreviewed while its summary is in flight", () => {
    setStatsUnanswered();
    renderPane([openCourse("details")]);

    expect(screen.getByText("Artificial Intelligence")).toBeInTheDocument();
    expect(
      screen.queryByText("No reviews yet — be the first to write one."),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Reviews · /)).not.toBeInTheDocument();
  });

  it("says so when the review summary cannot be loaded", () => {
    setStatsUnanswered({ isError: true });
    renderPane([openCourse("details")]);

    expect(
      screen.getByText("Could not load what reviewers said about this course."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("No reviews yet — be the first to write one."),
    ).not.toBeInTheDocument();
  });

  it("opens the review draft in its own tab", async () => {
    const user = userEvent.setup({ delay: null });
    const { props } = renderPane([openCourse("details")]);

    await user.click(screen.getByRole("button", { name: "Write a review" }));

    expect(props.onOpen).toHaveBeenCalledWith("DD2380", "review");
  });

  it("loads the written reviews only once they are asked for", async () => {
    const user = userEvent.setup({ delay: null });
    renderPane([openCourse("details")]);

    expect(useReviewList).toHaveBeenCalledWith(undefined);

    setReviewList([{ id: "rev-1", courseCode: "DD2380" }]);
    await user.click(screen.getByRole("button", { name: /Reviews · 4/ }));

    expect(useReviewList).toHaveBeenLastCalledWith("DD2380");
    expect(screen.getByTestId("review-card")).toHaveTextContent("rev-1");
  });

  it("does not put the summary's count over a list that failed", async () => {
    const user = userEvent.setup({ delay: null });
    renderPane([openCourse("details")]);

    // The count comes from `course.summary` and the list from `reviews.list`.
    // Four reviews over an empty list would read as four reviews deleted.
    setReviewList([], { isSuccess: false, isError: true });
    await user.click(screen.getByRole("button", { name: /Reviews · 4/ }));

    expect(screen.queryByTestId("review-list")).not.toBeInTheDocument();
    expect(
      screen.getByText(/Could not load the reviews for this course/),
    ).toBeInTheDocument();
  });
});

describe("the review draft tab", () => {
  it("counts the sections as they are answered", async () => {
    const user = userEvent.setup({ delay: null });
    renderPane([openCourse("review")]);

    expect(screen.getByText("0 of 3 sections done")).toBeInTheDocument();

    await user.click(
      screen.getByRole("checkbox", {
        name: "I don't remember how it was examined",
      }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: "I don't remember the approach" }),
    );

    expect(screen.getByText("1 of 3 sections done")).toBeInTheDocument();
  });

  it("splits the examination bar evenly as formats are picked", async () => {
    const user = userEvent.setup({ delay: null });
    renderPane([openCourse("review")]);

    expect(
      screen.getByText("Click the formats this course used"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Exam" }));
    await user.click(screen.getByRole("button", { name: "Labs" }));

    expect(screen.getByText("50 / 50")).toBeInTheDocument();
  });

  it("will not publish until happy took and both scores are answered", async () => {
    const user = userEvent.setup({ delay: null });
    renderPane([openCourse("review")]);

    const publish = screen.getByRole("button", { name: "Post review" });
    expect(publish).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Yes, I am" }));
    expect(publish).toBeDisabled();

    setScore("How demanding was this course?", 8);
    setScore("How much did you learn in this course?", 6);

    expect(publish).toBeEnabled();
  });

  it("publishes the draft as the wire contract, absent answers and all", async () => {
    const user = userEvent.setup({ delay: null });
    renderPane([openCourse("review")]);

    await user.click(screen.getByRole("button", { name: "Yes, I am" }));
    setScore("How demanding was this course?", 8);
    setScore("How much did you learn in this course?", 6);
    await user.type(
      screen.getByRole("textbox", { name: "Write your review" }),
      "Hard but worth it.",
    );
    await user.click(screen.getByRole("button", { name: "Post review" }));

    expect(addReview).toHaveBeenCalledWith("DD2380", {
      examinationDistribution: null,
      approachTheoryPercent: null,
      workloadScore: 8,
      learningScore: 6,
      happyTook: true,
      message: "Hard but worth it.",
    });
    expect(await screen.findByText(/Published. Thanks/)).toBeInTheDocument();
  });

  it("asks a visitor to sign in instead of publishing", async () => {
    const user = userEvent.setup({ delay: null });
    useMe.mockReturnValue({ isAuthenticated: false, isLoading: false });
    renderPane([openCourse("review")]);

    await user.click(screen.getByRole("button", { name: "Yes, I am" }));
    setScore("How demanding was this course?", 8);
    setScore("How much did you learn in this course?", 6);
    await user.click(screen.getByRole("button", { name: "Post review" }));

    expect(
      await screen.findByText("Sign in to publish your review"),
    ).toBeInTheDocument();
    expect(addReview).not.toHaveBeenCalled();
  });
});

describe("what survives a page load", () => {
  it("keeps a draft across a remount, because signing in reloads the page", async () => {
    const user = userEvent.setup({ delay: null });
    const { unmount } = renderPane([openCourse("review")]);

    await user.type(
      screen.getByRole("textbox", { name: "Write your review" }),
      "Half a thought",
    );
    expect(screen.getByText("Saved just now")).toBeInTheDocument();
    unmount();

    renderPane([openCourse("review")]);
    expect(
      screen.getByRole("textbox", { name: "Write your review" }),
    ).toHaveValue("Half a thought");
  });

  it("says nothing is saved until there is something to save", () => {
    renderPane([openCourse("review")]);

    expect(screen.getByText("Not saved yet")).toBeInTheDocument();
  });

  it("welcomes the writer back with the draft they left", async () => {
    const user = userEvent.setup({ delay: null });
    useMe.mockReturnValue({ isAuthenticated: false, isLoading: false });
    const { unmount } = renderPane([openCourse("review")]);

    await user.click(screen.getByRole("button", { name: "Yes, I am" }));
    setScore("How demanding was this course?", 8);
    setScore("How much did you learn in this course?", 6);
    await user.click(screen.getByRole("button", { name: "Post review" }));
    unmount();

    useMe.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { name: "Elsa Lindqvist" },
    });
    renderPane([openCourse("review")]);

    expect(
      await screen.findByText(/Signed in as Elsa Lindqvist/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Publish review" }),
    ).toBeEnabled();
  });

  it("will not take a second review for a course already reviewed", async () => {
    const user = userEvent.setup({ delay: null });
    const { unmount } = renderPane([openCourse("review")]);

    await user.click(screen.getByRole("button", { name: "Yes, I am" }));
    setScore("How demanding was this course?", 8);
    setScore("How much did you learn in this course?", 6);
    await user.click(screen.getByRole("button", { name: "Post review" }));
    await screen.findByText(/Published. Thanks/);
    unmount();

    // What `reviews.create` invalidated into the list, and equally what a
    // review published last week or from the course page would look like.
    setReviewList([{ id: "rev-1", courseCode: "DD2380", userId: "u1" }]);
    renderPane([openCourse("review")]);

    expect(
      screen.getByText(/You have already reviewed this course/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Post review" })).toBeDisabled();
  });

  it("refuses a second review while the list is still being asked again", async () => {
    const user = userEvent.setup({ delay: null });
    const { unmount } = renderPane([openCourse("review")]);

    await user.click(screen.getByRole("button", { name: "Yes, I am" }));
    setScore("How demanding was this course?", 8);
    setScore("How much did you learn in this course?", 6);
    // The request that would confirm the publication never answers, so the
    // workspace's own note that it published is all there is to go on — and
    // it has to be enough.
    reviewListStaysPending();
    await user.click(screen.getByRole("button", { name: "Post review" }));
    await screen.findByText(/Published. Thanks/);
    unmount();

    // The response in hand was fetched before the write and says nothing
    // about it. A filled-in draft still cannot publish.
    setReviewList([]);
    reviewListStaysPending();
    renderPane([openCourse("review")]);
    await user.click(screen.getByRole("button", { name: "Yes, I am" }));
    setScore("How demanding was this course?", 4);
    setScore("How much did you learn in this course?", 4);

    expect(
      screen.getByText(/You have already reviewed this course/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Post review" })).toBeDisabled();
    expect(addReview).toHaveBeenCalledTimes(1);
  });

  it("keeps the note when the list cannot be asked again", async () => {
    const user = userEvent.setup({ delay: null });
    const { unmount } = renderPane([openCourse("review")]);

    await user.click(screen.getByRole("button", { name: "Yes, I am" }));
    setScore("How demanding was this course?", 8);
    setScore("How much did you learn in this course?", 6);
    reviewListRefetchFails();
    await user.click(screen.getByRole("button", { name: "Post review" }));
    await screen.findByText(/Published. Thanks/);
    unmount();

    // A request that failed is not evidence the review is gone.
    setReviewList([]);
    reviewListRefetchFails();
    renderPane([openCourse("review")]);
    await user.click(screen.getByRole("button", { name: "Yes, I am" }));
    setScore("How demanding was this course?", 4);
    setScore("How much did you learn in this course?", 4);

    expect(
      await screen.findByText(/You have already reviewed this course/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Post review" })).toBeDisabled();
  });

  it("lets a reviewer write again when the review was deleted before this pane saw it", async () => {
    const user = userEvent.setup({ delay: null });
    const first = renderPane([openCourse("review")]);

    await user.click(screen.getByRole("button", { name: "Yes, I am" }));
    setScore("How demanding was this course?", 8);
    setScore("How much did you learn in this course?", 6);
    reviewListStaysPending();
    await user.click(screen.getByRole("button", { name: "Post review" }));
    await screen.findByText(/Published. Thanks/);
    first.unmount();

    // Deleted from another surface before this pane ever saw it in a list.
    // The request this panel starts itself began after the write, so its
    // answer is the authority even though the review never appeared in one.
    setReviewList([]);
    renderPane([openCourse("review")]);
    await user.click(screen.getByRole("button", { name: "Yes, I am" }));
    setScore("How demanding was this course?", 4);
    setScore("How much did you learn in this course?", 4);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Post review" })).toBeEnabled(),
    );
  });

  it("lets a reviewer write again after deleting the review they published", async () => {
    const user = userEvent.setup({ delay: null });
    const first = renderPane([openCourse("review")]);

    await user.click(screen.getByRole("button", { name: "Yes, I am" }));
    setScore("How demanding was this course?", 8);
    setScore("How much did you learn in this course?", 6);
    // What the list holds once the write has landed in it.
    reviewListNow([{ id: "rev-1", courseCode: "DD2380", userId: "u1" }]);
    await user.click(screen.getByRole("button", { name: "Post review" }));
    await screen.findByText(/Published. Thanks/);
    first.unmount();

    // The list has caught up, which is what the workspace's note was covering.
    setReviewList([{ id: "rev-1", courseCode: "DD2380", userId: "u1" }]);
    const second = renderPane([openCourse("review")]);
    expect(
      await screen.findByText(/You have already reviewed this course/),
    ).toBeInTheDocument();
    second.unmount();

    // The reviewer deletes it from the course's reviews. Nothing should stand
    // between them and writing another — least of all a stale note.
    setReviewList([]);
    renderPane([openCourse("review")]);
    await user.click(screen.getByRole("button", { name: "Yes, I am" }));
    setScore("How demanding was this course?", 4);
    setScore("How much did you learn in this course?", 4);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Post review" })).toBeEnabled(),
    );
    expect(
      screen.queryByText(/You have already reviewed this course/),
    ).not.toBeInTheDocument();
  });

  it("forgets a draft once it is a published review", async () => {
    const user = userEvent.setup({ delay: null });
    const { unmount } = renderPane([openCourse("review")]);

    await user.click(screen.getByRole("button", { name: "Yes, I am" }));
    setScore("How demanding was this course?", 8);
    setScore("How much did you learn in this course?", 6);
    await user.type(
      screen.getByRole("textbox", { name: "Write your review" }),
      "Worth it.",
    );
    await user.click(screen.getByRole("button", { name: "Post review" }));
    await screen.findByText(/Published. Thanks/);
    unmount();

    renderPane([openCourse("review")]);

    expect(
      screen.getByRole("textbox", { name: "Write your review" }),
    ).toHaveValue("");
  });

  it("drops the welcome when the visitor backs out of signing in", async () => {
    const user = userEvent.setup({ delay: null });
    useMe.mockReturnValue({ isAuthenticated: false, isLoading: false });
    const { unmount } = renderPane([openCourse("review")]);

    await user.click(screen.getByRole("button", { name: "Yes, I am" }));
    setScore("How demanding was this course?", 8);
    setScore("How much did you learn in this course?", 6);
    await user.click(screen.getByRole("button", { name: "Post review" }));
    await screen.findByText("Sign in to publish your review");
    await user.click(screen.getByRole("button", { name: "Back to my draft" }));
    unmount();

    useMe.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { name: "Elsa Lindqvist" },
    });
    renderPane([openCourse("review")]);

    expect(screen.queryByText(/Signed in as/)).not.toBeInTheDocument();
  });

  it("keeps a published review in the tab it was published from", async () => {
    const user = userEvent.setup({ delay: null });
    const open = [openCourse("review"), openCourse("review", "SF1626")];
    const { rerender, props } = renderPane(open);

    await user.click(screen.getByRole("button", { name: "Yes, I am" }));
    setScore("How demanding was this course?", 8);
    setScore("How much did you learn in this course?", 6);
    await user.click(screen.getByRole("button", { name: "Post review" }));
    await screen.findByText(/Published. Thanks/);

    rerender(
      <WorkspacePane {...props} openCourses={open} activeId="review:SF1626" />,
    );

    expect(screen.queryByText(/Published. Thanks/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Post review" })).toBeDisabled();
    expect(screen.getByText("Not saved yet")).toBeInTheDocument();
  });

  it("leaves the welcome for the course that asked for the sign-in", async () => {
    const user = userEvent.setup({ delay: null });
    useMe.mockReturnValue({ isAuthenticated: false, isLoading: false });
    const { unmount } = renderPane([openCourse("review")]);

    await user.click(screen.getByRole("button", { name: "Yes, I am" }));
    setScore("How demanding was this course?", 8);
    setScore("How much did you learn in this course?", 6);
    await user.click(screen.getByRole("button", { name: "Post review" }));
    unmount();

    useMe.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { name: "Elsa Lindqvist" },
    });
    renderPane([openCourse("review", "SF1626")]);

    expect(screen.queryByText(/Signed in as/)).not.toBeInTheDocument();
  });
});

/** The score tracks are range inputs behind the design's own bar. */
function setScore(label: string, value: number) {
  const slider = screen.getByRole("slider", { name: label });
  fireEvent.change(slider, { target: { value: String(value) } });
}
