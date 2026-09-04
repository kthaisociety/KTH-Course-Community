import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CourseCardChartData, CourseCardStats } from "@/data/courseCardMockData";
import { CourseCardWithCharts } from "./course-card-with-charts";

const CHART_DATA: CourseCardChartData = {
  examinationMethods: {
    homeAssignments: 30,
    onCampusExam: 40,
    laboratoryMoments: 30,
  },
  theoreticalVsApplied: { theoretical: 60, applied: 40 },
  workload: 7,
  learningExperience: 8,
};

const STATS: CourseCardStats = {
  recommendCount: 2,
  studentsTaken: 4,
  reviewCount: 3,
};

function renderCard(overrides: Partial<React.ComponentProps<typeof CourseCardWithCharts>> = {}) {
  const props = {
    title: "Artificial Intelligence",
    summary: "A course summary.",
    courseCode: "DD2380",
    department: "EECS",
    hp: 6,
    keywords: "AI",
    prerequisites: [],
    chartData: CHART_DATA,
    stats: STATS,
    isUserFavorite: false,
    onCardClick: vi.fn(),
    onWriteReview: vi.fn(),
    onToggleFavorite: vi.fn(),
    onAddToCollection: vi.fn(),
    ...overrides,
  };

  render(<CourseCardWithCharts {...props} />);
  return props;
}

describe("CourseCardWithCharts", () => {
  it("names the collection action without Compare wording", () => {
    renderCard();

    expect(
      screen.getByRole("button", { name: "Add to collection" }),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Compare" })).toBeNull();
  });

  it("adds to a collection without opening the course", async () => {
    const onCardClick = vi.fn();
    const onAddToCollection = vi.fn();
    renderCard({ onCardClick, onAddToCollection });

    await userEvent.click(
      screen.getByRole("button", { name: "Add to collection" }),
    );

    expect(onAddToCollection).toHaveBeenCalledOnce();
    expect(onCardClick).not.toHaveBeenCalled();
  });
});
