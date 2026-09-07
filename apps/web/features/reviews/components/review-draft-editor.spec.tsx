import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EMPTY_REVIEW_DRAFT, type ReviewDraft } from "../lib/review-draft";
import { ReviewDraftEditor } from "./review-draft-editor";

/**
 * The examination bar's drag, which is the only thing in this component that
 * outlives a render.
 *
 * Everything else here is a controlled input over the shared model, and the
 * model has its own suite next door — `lib/review-answers.spec.ts` is where
 * `moveDivider` is tested, and re-asserting its arithmetic through the DOM
 * would be testing the same function twice. What is only testable here is the
 * lifetime of the `window` listeners a drag installs.
 */

const TWO_METHODS: ReviewDraft = {
  ...EMPTY_REVIEW_DRAFT,
  methods: ["exam", "labs"],
  shares: [60, 40],
};

/**
 * jsdom lays nothing out, so the track measures 0×0 and every drag would
 * divide by zero. This is the 400px-wide bar the component believes it has.
 */
function measureTrack() {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    left: 0,
    right: 400,
    width: 400,
    top: 0,
    bottom: 38,
    height: 38,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
}

function divider() {
  return screen.getByRole("slider", { name: /Share between Exam and Labs/ });
}

describe("the examination bar's drag", () => {
  it("moves the divider the pointer is holding", () => {
    measureTrack();
    const onChange = vi.fn();
    render(<ReviewDraftEditor draft={TWO_METHODS} onChange={onChange} />);

    fireEvent.pointerDown(divider());
    fireEvent.pointerMove(window, { clientX: 300 });

    // 300 of 400px is 75%, and the pair is the whole bar.
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ shares: [75, 25] }),
    );
  });

  /*
   * The drag lives on `window`, because the pointer leaves a 38px track almost
   * at once. Without a cleanup it also outlives the component: a reviewer
   * dragging a divider when the editor goes away — the pane's tab closed, My
   * Page's back link, a save — left listeners calling the `onChange` of a host
   * that no longer exists, with the draft frozen as it was at `pointerdown`,
   * on every mouse move until the button came up.
   */
  it("stops when the editor goes away mid-drag", () => {
    measureTrack();
    const onChange = vi.fn();
    const { unmount } = render(
      <ReviewDraftEditor draft={TWO_METHODS} onChange={onChange} />,
    );

    fireEvent.pointerDown(divider());
    fireEvent.pointerMove(window, { clientX: 300 });
    expect(onChange).toHaveBeenCalledTimes(1);

    unmount();
    fireEvent.pointerMove(window, { clientX: 100 });

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  /** A touch gesture the browser takes over never sends `pointerup` at all. */
  it("stops when the gesture is cancelled rather than finished", () => {
    measureTrack();
    const onChange = vi.fn();
    render(<ReviewDraftEditor draft={TWO_METHODS} onChange={onChange} />);

    fireEvent.pointerDown(divider());
    fireEvent.pointerCancel(window);
    fireEvent.pointerMove(window, { clientX: 300 });

    expect(onChange).not.toHaveBeenCalled();
  });
});
