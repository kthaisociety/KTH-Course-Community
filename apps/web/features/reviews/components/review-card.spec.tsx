import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Review } from "@/types";
import { EXAMINATION_COLORS } from "../lib/examination-palette";
import { ReviewCard } from "./review-card";

function makeReview(overrides: Partial<Review> = {}): Review {
  return {
    id: "r1",
    userId: "u1",
    courseCode: "DD1337",
    examinationDistribution: {
      exam: 50,
      assignments: 30,
      labs: 20,
      projects: 0,
      seminars: 0,
      other: 0,
    },
    approachTheoryPercent: 65,
    workloadScore: 7,
    learningScore: 9,
    happyTook: true,
    message: "<p>Do the assignments the week they open.</p>",
    createdAt: "2026-01-12T10:00:00.000Z",
    updatedAt: "2026-01-12T10:00:00.000Z",
    upvoteCount: 12,
    downvoteCount: 4,
    userVote: null,
    ...overrides,
  };
}

/** The card starts collapsed; the detail is behind its disclosure. */
async function expand() {
  await userEvent.click(screen.getByRole("button", { expanded: false }));
}

describe("ReviewCard", () => {
  it("shows the verdict, the excerpt, the course and the net score", () => {
    render(<ReviewCard review={makeReview()} onVote={vi.fn()} />);

    expect(screen.getByText("Happy they took it")).toBeInTheDocument();
    expect(
      screen.getByText("Do the assignments the week they open."),
    ).toBeInTheDocument();
    expect(screen.getByText("DD1337")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
  });

  // Reviews are attributed to a user id and the artboard renders no name; the
  // design's mock store carries an `author` that the schema has no column for.
  it("names nobody", () => {
    render(<ReviewCard review={makeReview()} onVote={vi.fn()} />);
    expect(screen.queryByText(/written by/i)).not.toBeInTheDocument();
  });

  it("reads a scale of ten raw, never rescaled to five", async () => {
    render(<ReviewCard review={makeReview()} onVote={vi.fn()} />);
    await expand();

    expect(screen.getByText("7 / 10")).toBeInTheDocument();
    expect(screen.getByText("9 / 10")).toBeInTheDocument();
  });

  it("draws a segment per answered examination category", async () => {
    render(<ReviewCard review={makeReview()} onVote={vi.fn()} />);
    await expand();

    expect(screen.getByText("50% / 30% / 20%")).toBeInTheDocument();
    expect(screen.getByText("Exam 50%")).toBeInTheDocument();
    expect(screen.getByText("Assignments 30%")).toBeInTheDocument();
    expect(screen.getByText("Labs 20%")).toBeInTheDocument();
  });

  it("gives seminars its own colour rather than another category's", async () => {
    render(
      <ReviewCard
        review={makeReview({
          examinationDistribution: {
            exam: 40,
            assignments: 0,
            labs: 0,
            projects: 0,
            seminars: 60,
            other: 0,
          },
        })}
        onVote={vi.fn()}
      />,
    );
    await expand();

    const seminars = screen.getByText("Seminars 60%");
    expect(seminars).toHaveStyle({
      background: EXAMINATION_COLORS.seminars,
    });
    expect(EXAMINATION_COLORS.seminars).not.toBe(EXAMINATION_COLORS.exam);
  });

  it("says an unanswered examination split is unanswered, never zero", async () => {
    render(
      <ReviewCard
        review={makeReview({ examinationDistribution: null })}
        onVote={vi.fn()}
      />,
    );
    await expand();

    expect(screen.getAllByText(/I don't remember/)).not.toHaveLength(0);
    expect(screen.queryByText(/Exam 0%/)).not.toBeInTheDocument();
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
    expect(screen.getAllByText("Not recorded")).toHaveLength(1);
  });

  it("says an unanswered theory split is unanswered, never zero", async () => {
    render(
      <ReviewCard
        review={makeReview({ approachTheoryPercent: null })}
        onVote={vi.fn()}
      />,
    );
    await expand();

    expect(screen.getAllByText("Not recorded")).toHaveLength(1);
    expect(screen.queryByText("Theoretical")).not.toBeInTheDocument();
    expect(screen.queryByText("Applied")).not.toBeInTheDocument();
    expect(screen.getAllByText(/I don't remember/)).not.toHaveLength(0);
  });

  it("draws the theory split when the reviewer did remember", async () => {
    render(<ReviewCard review={makeReview()} onVote={vi.fn()} />);
    await expand();

    expect(screen.getByText("65 / 35")).toBeInTheDocument();
    expect(screen.getByText("Theoretical")).toHaveStyle({ width: "65%" });
    expect(screen.getByText("Applied")).toHaveStyle({ width: "35%" });
  });

  it("votes up", async () => {
    const onVote = vi.fn();
    render(<ReviewCard review={makeReview()} onVote={onVote} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Upvote this review" }),
    );
    expect(onVote).toHaveBeenCalledExactlyOnceWith("up");
  });

  it("votes down", async () => {
    const onVote = vi.fn();
    render(<ReviewCard review={makeReview()} onVote={onVote} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Downvote this review" }),
    );
    expect(onVote).toHaveBeenCalledExactlyOnceWith("down");
  });

  it("gives a visitor the score but nothing to press", () => {
    render(<ReviewCard review={makeReview({ userVote: "down" })} />);
    expect(
      screen.queryByRole("button", { name: "Downvote this review" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
  });

  it("marks the viewer's own vote pressed", () => {
    render(
      <ReviewCard review={makeReview({ userVote: "up" })} onVote={vi.fn()} />,
    );

    expect(
      screen.getByRole("button", { name: "Upvote this review" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "Downvote this review" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("offers the author editing and deleting", async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <ReviewCard
        review={makeReview()}
        isAuthor
        onVote={vi.fn()}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    );
    await expand();

    await userEvent.click(screen.getByRole("button", { name: "Edit review" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Delete review" }),
    );
    expect(onEdit).toHaveBeenCalledOnce();
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it("offers nobody else editing or deleting", async () => {
    render(
      <ReviewCard
        review={makeReview()}
        isAuthor={false}
        onVote={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    await expand();

    expect(
      screen.queryByRole("button", { name: "Edit review" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Delete review" }),
    ).not.toBeInTheDocument();
  });

  it("says so when a reviewer scored the course but wrote nothing", () => {
    render(
      <ReviewCard review={makeReview({ message: null })} onVote={vi.fn()} />,
    );
    expect(
      screen.getByText("Scores only — this reviewer wrote nothing."),
    ).toBeInTheDocument();
  });

  it("reads an unhappy review as unhappy", () => {
    render(
      <ReviewCard review={makeReview({ happyTook: false })} onVote={vi.fn()} />,
    );
    expect(screen.getByText("Not really")).toBeInTheDocument();
  });
});
