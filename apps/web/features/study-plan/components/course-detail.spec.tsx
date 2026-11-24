import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CourseReviewStats } from "@/types";
import type { PlanItem } from "../lib/build-plan";
import { CourseDetail } from "./course-detail";

const item = (over: Partial<PlanItem> = {}): PlanItem => ({
  code: "IV1350",
  title: "Object Oriented Design",
  credits: 7.5,
  level: "B",
  source: "programme",
  category: "VV",
  mandatory: false,
  syllabusYear: 2,
  taken: {
    courseCode: "IV1350",
    grade: "B",
    earnedCredits: 7.5,
    attendanceYear: 2026,
  },
  slot: { ay: 2025, p: 4 },
  placedByStudent: false,
  segments: [{ slot: { ay: 2025, p: 4 }, credits: 7.5 }],
  pace: 50,
  roundSource: "programme",
  offeredStarts: [4],
  offPeriod: false,
  status: "passed",
  counts: true,
  startIdx: 20254,
  endIdx: 20254,
  ...over,
});

function renderDetail(
  over: Partial<PlanItem>,
  props: {
    signedIn?: boolean;
    failed?: boolean;
    reviews?: CourseReviewStats | null;
  } = {},
) {
  const onMarkFailed = vi.fn();
  const onMarkPassed = vi.fn();
  render(
    <CourseDetail
      item={item(over)}
      checks={[]}
      options={[]}
      signedIn={props.signedIn ?? true}
      failed={props.failed ?? false}
      onClose={() => {}}
      onMove={() => {}}
      onFix={() => {}}
      onDismiss={() => {}}
      onLeaveOut={() => {}}
      onRemove={() => {}}
      onResetSlot={() => {}}
      onMarkPassed={onMarkPassed}
      onMarkFailed={onMarkFailed}
      reviews={props.reviews}
    />,
  );
  return { onMarkFailed, onMarkPassed };
}

describe("CourseDetail", () => {
  it("lets a passed course be marked as failed, next to its status", () => {
    const { onMarkFailed } = renderDetail({});
    expect(screen.getByText(/^Passed/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Mark as failed/ }));
    expect(onMarkFailed).toHaveBeenCalledOnce();
  });

  it("says Failed for a failed taken course, and lets it be marked as passed", () => {
    const { onMarkPassed } = renderDetail(
      { status: "not-passed", taken: null, counts: false },
      { failed: true },
    );
    expect(screen.getByText("Failed")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Mark as passed/ }));
    expect(onMarkPassed).toHaveBeenCalledOnce();
  });

  it("offers no result change to a visitor, who has no taken courses to write", () => {
    renderDetail({}, { signedIn: false });
    expect(screen.queryByRole("button", { name: /Mark as failed/ })).toBeNull();
  });

  it("labels the course mandatory or elective, as the grid does, and shows pace on its own", () => {
    renderDetail({ mandatory: true, category: "O" });
    expect(screen.getByText("Mandatory")).toBeInTheDocument();
    expect(screen.getByText("50 %")).toBeInTheDocument();
  });

  it("shows learning and workload as scores out of 10, with how many are glad", () => {
    renderDetail(
      {},
      {
        reviews: {
          learningMean: 8.2,
          workloadMean: 6.1,
          happyPercent: 86,
          reviewCount: 12,
        } as CourseReviewStats,
      },
    );
    expect(screen.getByText("Learning")).toBeInTheDocument();
    expect(screen.getByText("8.2")).toBeInTheDocument();
    expect(screen.getByText("Workload")).toBeInTheDocument();
    expect(screen.getByText("6.1")).toBeInTheDocument();
    expect(
      screen.getByText(/glad they took it · 12 reviews/),
    ).toBeInTheDocument();
  });

  it("says so when nobody has reviewed the course", () => {
    renderDetail({}, { reviews: null });
    expect(screen.getByText("No reviews yet.")).toBeInTheDocument();
  });

  it("offers a passed course's review as its own full-width button", () => {
    renderDetail({});
    expect(
      screen.getByRole("link", { name: "Write a review" }),
    ).toHaveAttribute("href", "/search?open=IV1350&kind=review");
  });

  it("removes an added elective from the plan rather than leaving it out", () => {
    renderDetail({ taken: null, status: "planned", placedByStudent: true });
    expect(
      screen.getByRole("button", { name: /Remove from plan/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Don't include/ })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Back to the syllabus period/ }),
    ).toBeNull();
  });

  it("sends a moved mandatory course back to its period, and can only leave it out", () => {
    renderDetail({
      mandatory: true,
      category: "O",
      taken: null,
      status: "planned",
      placedByStudent: true,
    });
    expect(
      screen.getByRole("button", { name: /Back to the syllabus period/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Don't include/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Remove from plan/ }),
    ).toBeNull();
  });

  it("offers no review to a visitor", () => {
    renderDetail({}, { signedIn: false });
    expect(
      screen.queryByRole("link", { name: "Write a review" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Learning")).not.toBeInTheDocument();
  });
});
