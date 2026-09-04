import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { selectUnreviewedCourses } from "../lib/unreviewed";
import { UnreviewedCard, type UnreviewedCourse } from "./unreviewed-card";

const VIEWER = "u1";

/** `taken.list` carries a code and self-reported facts; the name is the screen's. */
const TAKEN = [
  { courseCode: "DD2424", name: "Deep Learning in Data Science" },
  { courseCode: "SF1918", name: "Probability and Statistics" },
];

type ReviewedBy = { courseCode: string; userId: string };

/**
 * Exactly what a screen does — difference the two lists, then map the result
 * onto card props — so these cover the seam Taken courses and My Page use, not
 * a hand-written list that could drift from it.
 */
function renderScreen(
  reviews: ReviewedBy[],
  over: Partial<Parameters<typeof UnreviewedCard>[0]> = {},
) {
  const courses: UnreviewedCourse[] = selectUnreviewedCourses(
    TAKEN,
    reviews,
    VIEWER,
  ).map((course) => ({ code: course.courseCode, name: course.name }));

  return render(
    <UnreviewedCard courses={courses} onStart={() => {}} {...over} />,
  );
}

describe("UnreviewedCard", () => {
  it("prompts for taken courses with no review and routes each into the review flow", () => {
    renderScreen([]);

    expect(
      screen.getByText("2 courses have no review yet"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Your review is what the next student reads."),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: /Deep Learning in Data Science/ }),
    ).toHaveAttribute("href", "/course/DD2424?writeReview=1");
    expect(
      screen.getByRole("link", { name: /Probability and Statistics/ }),
    ).toHaveAttribute("href", "/course/SF1918?writeReview=1");
  });

  it("leaves out a taken course the viewer has already reviewed", () => {
    renderScreen([{ courseCode: "SF1918", userId: VIEWER }]);

    expect(screen.getByText("1 course has no review yet")).toBeInTheDocument();
    expect(screen.getByText("DD2424")).toBeInTheDocument();
    expect(screen.queryByText("SF1918")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Probability and Statistics"),
    ).not.toBeInTheDocument();
  });

  // The prompt is the whole card, so with nothing to prompt for there is no
  // empty state to draw — the screens rely on this instead of each guarding.
  it("renders nothing once everything taken has been reviewed", () => {
    const { container } = renderScreen([
      { courseCode: "DD2424", userId: VIEWER },
      { courseCode: "SF1918", userId: VIEWER },
    ]);

    expect(container).toBeEmptyDOMElement();
  });

  it("counts the fast track's label and opens the reviewer with it", async () => {
    const onStart = vi.fn();
    const { rerender } = renderScreen([], { onStart });

    await userEvent.click(
      screen.getByRole("button", { name: "Fast track all 2" }),
    );
    expect(onStart).toHaveBeenCalledOnce();

    rerender(
      <UnreviewedCard
        courses={[{ code: "DD2424", name: "Deep Learning in Data Science" }]}
        onStart={onStart}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Fast track it" }),
    ).toBeInTheDocument();
  });

  it("hands a row to onSelect instead of navigating when a screen supplies one", async () => {
    const onSelect = vi.fn();
    renderScreen([{ courseCode: "SF1918", userId: VIEWER }], { onSelect });

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /Deep Learning in Data Science/ }),
    );
    expect(onSelect).toHaveBeenCalledWith("DD2424");
  });

  it("collapses the tail of a long list and takes a headline of the screen's own", () => {
    render(
      <UnreviewedCard
        courses={["DD2424", "SF1918", "AK2030"].map((code) => ({ code }))}
        line="You have 3 unreviewed courses."
        max={2}
        onStart={() => {}}
      />,
    );

    expect(
      screen.getByText("You have 3 unreviewed courses."),
    ).toBeInTheDocument();
    expect(screen.getByText("+1 more")).toBeInTheDocument();
    expect(screen.queryByText("AK2030")).not.toBeInTheDocument();
  });
});
