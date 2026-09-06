import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Review } from "./review";

vi.mock("@/features/auth", () => ({
  useMe: () => ({ userId: "u1", isLoading: false }),
}));
vi.mock("../hooks/use-add-review", () => ({ useAddReview: () => vi.fn() }));
vi.mock("../hooks/use-edit-review", () => ({ useEditReview: () => vi.fn() }));

// Lexical boots a whole editor and this suite is about the dialog's box, not
// about what is typed into it.
vi.mock("@/components/RichEditor", () => ({
  RichTextEditor: () => <div data-testid="rich-text-editor" />,
}));

/** A published review, as the dialog takes it when My Page opens it to edit. */
const EDITING = {
  id: "r1",
  happyTook: true,
  message: "<p>Worth it.</p>",
  examinationDistribution: null,
  approachTheoryPercent: null,
  workloadScore: 6,
  learningScore: 8,
};

/**
 * The width-related utilities the dialog actually renders with.
 *
 * jsdom computes no layout — `getBoundingClientRect` is zeros and no Tailwind
 * stylesheet exists at test time — so the class list is the surface a test can
 * hold. It is not a proxy for the real thing either: this string is the output
 * of `cn`, which is where #178's bug lived, so a `sm:max-w-*` creeping back into
 * `DialogContent`'s base classes shows up here exactly as it would on screen.
 */
function widthClasses() {
  const content = document.querySelector('[data-slot="dialog-content"]');
  expect(content).not.toBeNull();
  return (content as HTMLElement).className
    .split(/\s+/)
    .filter((name) => /(^|:)(min-w|max-w|w)-/.test(name));
}

beforeEach(() => {
  // A phone. `Review` reads nothing off it, but the assertions below are about
  // what happens at this width, so the test states it rather than implying it.
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 390,
  });
});

describe("Review, as the edit-review dialog", () => {
  it("opens straight into editing when handed a review", () => {
    render(<Review courseCode="DD2380" editing={EDITING} onClose={vi.fn()} />);
    expect(
      screen.getByRole("heading", { name: /edit your review/i }),
    ).toBeInTheDocument();
  });

  it("never sets a min-width that could outgrow a phone", () => {
    render(<Review courseCode="DD2380" editing={EDITING} onClose={vi.fn()} />);

    // #165: this dialog carried `min-w-3xl`, 768px. Min-width beats max-width in
    // CSS, so it beat `DialogContent`'s own `max-w-[calc(100%-2rem)]` too and the
    // page scrolled sideways on every handset. Any `min-w-*` in a fixed unit is
    // the same bug wearing a different number, so none is allowed at all.
    expect(widthClasses().filter((name) => name.includes("min-w-"))).toEqual(
      [],
    );
  });

  it("caps its width against the viewport rather than a breakpoint", () => {
    render(<Review courseCode="DD2380" editing={EDITING} onClose={vi.fn()} />);
    const classes = widthClasses();

    // The cap has to name the viewport, or a phone gets 896px of dialog.
    expect(
      classes.some(
        (name) => name.startsWith("max-w-") && name.includes("100vw"),
      ),
    ).toBe(true);

    // #178: `DialogContent` must contribute no width of its own. If it does, it
    // arrives as an `sm:max-w-*` — a different tailwind-merge group from the
    // `max-w-*` above, so it would not replace it and would silently win from
    // 640px up.
    expect(classes.filter((name) => name.startsWith("sm:max-w-"))).toEqual([]);
  });
});
