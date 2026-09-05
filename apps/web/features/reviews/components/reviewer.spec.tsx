import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readReviewerSession } from "../lib/reviewer-session";
import type { ReviewFormData } from "./review";
import { Reviewer } from "./reviewer";
import type { ReviewerCardCourse } from "./reviewer-card";

const addReview =
  vi.fn<(code: string, form: ReviewFormData) => Promise<boolean>>();

vi.mock("../hooks/use-add-review", () => ({
  useAddReview: () => addReview,
}));

const QUEUE: ReviewerCardCourse[] = [
  {
    courseCode: "DD2424",
    name: "Deep Learning in Data Science",
    meta: "7.5 hp · 2025",
  },
  {
    courseCode: "SF1918",
    name: "Probability and Statistics",
    meta: "6.0 hp · 2024",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  addReview.mockResolvedValue(true);
});

/** Answers the three questions the card will not save without. */
async function answerCard(happy: "Yes, I am" | "No, not really" = "Yes, I am") {
  await userEvent.click(screen.getByRole("button", { name: happy }));
  fireEvent.change(screen.getByLabelText("How demanding was this course?"), {
    target: { value: "8" },
  });
  fireEvent.change(screen.getByLabelText("How much did you learn?"), {
    target: { value: "5" },
  });
}

function renderReviewer(queue = QUEUE, onClose = vi.fn()) {
  render(<Reviewer queue={queue} onClose={onClose} />);
  return onClose;
}

describe("the card stack", () => {
  it("deals one card at a time and says how many are behind it", () => {
    renderReviewer();

    expect(screen.getByText("Card 1 of 2")).toBeInTheDocument();
    expect(screen.getByText("1 more after this")).toBeInTheDocument();
    expect(
      screen.getByText("Deep Learning in Data Science"),
    ).toBeInTheDocument();
    expect(screen.getByText("7.5 hp · 2025")).toBeInTheDocument();
    // The second course is behind the active card, not on screen.
    expect(
      screen.queryByText("Probability and Statistics"),
    ).not.toBeInTheDocument();
  });

  it("falls back to the code before the catalogue has answered", () => {
    renderReviewer([{ courseCode: "DD2424" }]);

    expect(screen.getByRole("heading", { name: "DD2424" })).toBeInTheDocument();
    expect(screen.getByText("Last one")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Save and finish/ }),
    ).toBeInTheDocument();
  });

  it("will not save until happy, workload and learning are answered", async () => {
    renderReviewer();

    expect(
      screen.getByRole("button", { name: /Save and next/ }),
    ).toBeDisabled();

    await answerCard();

    expect(screen.getByRole("button", { name: /Save and next/ })).toBeEnabled();
  });
});

describe("what a saved card sends", () => {
  /**
   * The four questions are optional in different ways. Only the three the
   * schema requires gate the button; an untouched examination bar and an
   * untouched theory track are the "I don't remember" answer and store `null`,
   * never zeroes and never the midpoint the track happens to be drawn at.
   */
  it("stores nothing for the questions the reviewer left alone", async () => {
    renderReviewer([QUEUE[0]]);
    await answerCard();

    await userEvent.click(
      screen.getByRole("button", { name: /Save and finish/ }),
    );

    expect(addReview).toHaveBeenCalledWith("DD2424", {
      examinationDistribution: null,
      approachTheoryPercent: null,
      workloadScore: 8,
      learningScore: 5,
      happyTook: true,
      message: "",
    });
  });

  it("carries the formats, the split and the write-up when they were given", async () => {
    renderReviewer([QUEUE[0]]);
    await answerCard("No, not really");
    await userEvent.click(screen.getByRole("button", { name: "Labs" }));
    await userEvent.click(screen.getByRole("button", { name: "Exam" }));
    fireEvent.change(
      screen.getByLabelText(
        "How theoretical rather than applied the course was",
      ),
      { target: { value: "70" } },
    );
    await userEvent.type(
      screen.getByLabelText("One line for the next student"),
      "Start the labs early.",
    );

    await userEvent.click(
      screen.getByRole("button", { name: /Save and finish/ }),
    );

    expect(addReview).toHaveBeenCalledWith("DD2424", {
      examinationDistribution: {
        exam: 50,
        assignments: 0,
        labs: 50,
        projects: 0,
        seminars: 0,
        other: 0,
      },
      approachTheoryPercent: 70,
      workloadScore: 8,
      learningScore: 5,
      happyTook: false,
      message: "<p>Start the labs early.</p>",
    });
  });
});

describe("skipping", () => {
  /**
   * The screen's own copy promises it: skipped courses "stay in the list as
   * unreviewed". So a skip writes nothing at all — there is no dismissal to
   * store, and the next round offers the course again.
   */
  it("writes nothing and offers the skipped ones again", async () => {
    renderReviewer();

    await userEvent.click(screen.getByRole("button", { name: "Skip for now" }));
    expect(screen.getByText("Card 2 of 2")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Skip for now" }));

    expect(addReview).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "Nothing reviewed this round" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "The 2 you skipped are still marked unreviewed in your list — pick any of them up from there.",
      ),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Go through the skipped ones" }),
    );
    expect(screen.getByText("Card 1 of 2")).toBeInTheDocument();
  });

  it("deals only the skipped ones in the second round", async () => {
    renderReviewer();

    await answerCard();
    await userEvent.click(
      screen.getByRole("button", { name: /Save and next/ }),
    );
    await screen.findByText("Probability and Statistics");
    await userEvent.click(screen.getByRole("button", { name: "Skip for now" }));

    expect(
      screen.getByRole("heading", { name: "1 course reviewed" }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Go through the skipped ones" }),
    );

    expect(screen.getByText("Card 1 of 1")).toBeInTheDocument();
    expect(screen.getByText("Probability and Statistics")).toBeInTheDocument();
  });

  it("says so plainly when the whole round was reviewed", async () => {
    renderReviewer([QUEUE[0]]);
    await answerCard();
    await userEvent.click(
      screen.getByRole("button", { name: /Save and finish/ }),
    );

    expect(
      await screen.findByRole("heading", { name: "1 course reviewed" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Go through the skipped ones" }),
    ).not.toBeInTheDocument();
  });
});

describe("a save that does not land", () => {
  /**
   * `useAddReview` has already said what went wrong in a toast; the row is what
   * keeps the card, and the answers on it, in front of the reviewer instead of
   * advancing past work nothing stored.
   */
  it("keeps the card and its answers, and offers the save again", async () => {
    addReview.mockResolvedValue(false);
    renderReviewer();
    await answerCard();

    await userEvent.click(
      screen.getByRole("button", { name: /Save and next/ }),
    );

    expect(
      await screen.findByText(
        "That review did not reach the server. Nothing was lost — your answers are still on the card.",
      ),
    ).toBeInTheDocument();
    // Still card one, still holding what was answered.
    expect(screen.getByText("Card 1 of 2")).toBeInTheDocument();
    expect(screen.getByText("8 / 10")).toBeInTheDocument();

    addReview.mockResolvedValue(true);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() =>
      expect(screen.getByText("Card 2 of 2")).toBeInTheDocument(),
    );
    expect(addReview).toHaveBeenCalledTimes(2);
  });

  it("clears the error when the reviewer skips past the card instead", async () => {
    addReview.mockResolvedValue(false);
    renderReviewer();
    await answerCard();
    await userEvent.click(
      screen.getByRole("button", { name: /Save and next/ }),
    );
    await screen.findByText(/did not reach the server/);

    await userEvent.click(screen.getByRole("button", { name: "Skip for now" }));

    expect(
      screen.queryByText(/did not reach the server/),
    ).not.toBeInTheDocument();
  });
});

/**
 * The reviewer writes the round to `sessionStorage` and is handed one back as
 * a prop — reading it is `TakenCourses`' job, because only that screen knows
 * which courses are still unreviewed. These tests exercise both halves of the
 * seam: what gets written, and what a component handed it back does with it.
 */
describe("a round a reload interrupted", () => {
  it("writes the round down as it goes", async () => {
    render(<Reviewer queue={QUEUE} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Skip for now" }));
    await answerCard();

    expect(readReviewerSession()).toMatchObject({
      queue: ["DD2424", "SF1918"],
      done: { DD2424: "skipped" },
      drafts: {
        SF1918: { happyTook: true, workloadScore: 8, learningScore: 5 },
      },
    });
  });

  it("comes back with the same queue, progress and unsaved answers", async () => {
    const { unmount } = render(<Reviewer queue={QUEUE} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Skip for now" }));
    await answerCard();
    unmount();

    render(
      <Reviewer
        queue={QUEUE}
        restored={readReviewerSession()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Card 2 of 2")).toBeInTheDocument();
    expect(screen.getByText("Probability and Statistics")).toBeInTheDocument();
    expect(screen.getByText("8 / 10")).toBeInTheDocument();
    expect(screen.getByText("5 / 10")).toBeInTheDocument();
  });

  /**
   * A stored round only belongs to the queue it was started on. Restoring one
   * round's drafts onto a different set of courses would put answers on cards
   * they were never written for, so a mismatch is discarded rather than
   * half-applied — even though the caller is supposed to have pruned it first.
   */
  it("is ignored when the queue is not the one it was stored for", async () => {
    render(<Reviewer queue={QUEUE} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Skip for now" }));

    render(
      <Reviewer
        queue={[QUEUE[1]]}
        restored={readReviewerSession()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Card 1 of 1")).toBeInTheDocument();
  });

  /** Nothing restored is a fresh round, whatever the tab happens to hold. */
  it("starts clean when no round is handed to it", async () => {
    const { unmount } = render(<Reviewer queue={QUEUE} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Skip for now" }));
    unmount();

    render(<Reviewer queue={QUEUE} onClose={vi.fn()} />);

    expect(screen.getByText("Card 1 of 2")).toBeInTheDocument();
  });
});
