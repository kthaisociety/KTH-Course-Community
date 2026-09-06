import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MAX_REVIEW_SCORE } from "@/types";
import { ScoreSlider } from "./score-controls";

/**
 * The two drifts that made this component worth extracting, asserted so a
 * second copy cannot reintroduce them quietly.
 *
 * Both had survived review in `review-draft-panel.tsx`'s copy: an
 * `aria-valuetext` that said "of 10" where the card read `MAX_REVIEW_SCORE`,
 * and a track filled with `--cc-warn-btn` where the artboards say `--btn`.
 */
function slider(value: number | null) {
  render(
    <ScoreSlider
      label="Workload"
      value={value}
      minLabel="Light"
      maxLabel="Heavy"
      onChange={vi.fn()}
    />,
  );
  return screen.getByRole("slider", { name: "Workload" });
}

describe("ScoreSlider", () => {
  it("states the scale from the constant, never a literal", () => {
    expect(slider(7)).toHaveAttribute(
      "aria-valuetext",
      `7 of ${MAX_REVIEW_SCORE}`,
    );
  });

  it("says Not set rather than the lowest answer when nothing is answered", () => {
    // `null` is "not answered" and 1 is "the lowest answer". Conflating them is
    // the reason the track is drawn by hand instead of by the range input.
    const input = slider(null);
    expect(input).toHaveAttribute("aria-valuetext", "Not set");
    expect(screen.getByText("Not set")).toBeInTheDocument();
  });

  /**
   * `Workspace Pane.dc.html` and `Taken Courses.dc.html` both draw the filled
   * part of the track as `background:var(--btn)`.
   *
   * The panel's copy used `--cc-warn-btn`. In light both tokens hold `#1751a6`,
   * so nothing showed; in dark `--cc-warn-btn` is `#dfa53c` and the slider drew
   * amber where the design says blue. A duplicate that is wrong in one theme
   * only is exactly what a rendered test in a single theme misses, so this
   * asserts the class rather than a computed colour.
   */
  it("fills the track with --cc-btn, which is what the artboards draw", () => {
    const input = slider(7);
    const track = input.parentElement?.querySelector(".bg-cc-pill > div");
    expect(track).not.toBeNull();
    expect(track).toHaveClass("bg-cc-btn");
    expect((track as HTMLElement).className).not.toContain("warn");
    expect((track as HTMLElement).style.width).toBe("70%");
  });
});
