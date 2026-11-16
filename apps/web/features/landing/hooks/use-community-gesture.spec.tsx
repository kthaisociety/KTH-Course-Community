import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCommunityGesture } from "./use-community-gesture";

/**
 * Scrolling up at the top of the page opens the community view. The gesture is
 * an extra on top of a visible control, so what matters most here is everything
 * it must *not* fire on.
 */

let realMatchMedia: typeof window.matchMedia;
let now: number;

/** Answer the "mouse or trackpad" query, which is what gates the gesture. */
function pointer(fine: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: fine,
  }) as unknown as typeof window.matchMedia;
}

/** One wheel event, `gap` ms after the last one. */
function wheel(deltaY: number, gap = 16) {
  now += gap;
  const event = new WheelEvent("wheel", { deltaY });
  Object.defineProperty(event, "timeStamp", { value: now });
  window.dispatchEvent(event);
}

function scrolledTo(top: number) {
  Object.defineProperty(window, "scrollY", { configurable: true, value: top });
}

function setup(over: { active?: boolean; disabled?: boolean } = {}) {
  const onEnter = vi.fn();
  const onLeave = vi.fn();
  const scroller = { current: document.createElement("div") };
  renderHook(() =>
    useCommunityGesture({
      scroller,
      active: over.active ?? false,
      disabled: over.disabled ?? false,
      onEnter,
      onLeave,
    }),
  );
  return { onEnter, onLeave, scroller };
}

beforeEach(() => {
  realMatchMedia = window.matchMedia;
  now = 10_000;
  pointer(true);
  scrolledTo(0);
});

afterEach(() => {
  window.matchMedia = realMatchMedia;
  scrolledTo(0);
});

describe("useCommunityGesture", () => {
  it("opens the view on a deliberate pull up at the top of the page", () => {
    const { onEnter } = setup();
    wheel(-50, 1000);
    wheel(-50);
    expect(onEnter).not.toHaveBeenCalled();
    wheel(-50);
    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it("ignores a single notch of the wheel", () => {
    const { onEnter } = setup();
    wheel(-100, 1000);
    wheel(-100, 1000);
    wheel(-100, 1000);
    expect(onEnter).not.toHaveBeenCalled();
  });

  // A reader flicking back up the page arrives at the top with momentum still
  // coming. That is the end of a scroll, not a request.
  it("ignores momentum that arrives at the top from further down", () => {
    const { onEnter } = setup();
    scrolledTo(400);
    wheel(-200, 1000);
    scrolledTo(0);
    wheel(-200);
    wheel(-200);
    wheel(-200);
    expect(onEnter).not.toHaveBeenCalled();
  });

  it("ignores a pull while the scroller itself is not at the top", () => {
    const { onEnter, scroller } = setup();
    scroller.current.scrollTop = 120;
    wheel(-200, 1000);
    wheel(-200);
    expect(onEnter).not.toHaveBeenCalled();
  });

  it("closes the view again on a scroll down", () => {
    const { onEnter, onLeave } = setup({ active: true });
    wheel(-300, 1000);
    expect(onLeave).not.toHaveBeenCalled();
    wheel(40, 1000);
    wheel(40);
    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(onEnter).not.toHaveBeenCalled();
  });

  // On a touch screen the same gesture is the browser's pull-to-refresh.
  it("does nothing without a mouse or trackpad", () => {
    pointer(false);
    const { onEnter } = setup();
    wheel(-200, 1000);
    wheel(-200);
    expect(onEnter).not.toHaveBeenCalled();
  });

  it("does nothing while a dialog or a departure owns the page", () => {
    const { onEnter } = setup({ disabled: true });
    wheel(-200, 1000);
    wheel(-200);
    expect(onEnter).not.toHaveBeenCalled();
  });
});
