import { type RefObject, useEffect, useRef } from "react";

/** How far the wheel has to be pulled up, at the top, to open the view, in px. */
const ENTER_PULL = 120;
/** How far it has to be pushed down to close it again, in px. */
const LEAVE_PUSH = 60;
/** A pause this long between wheel events starts a new gesture, in ms. */
const GESTURE_GAP_MS = 250;

/**
 * Scrolling up at the top of the landing page opens the **community view**, and
 * scrolling down closes it.
 *
 * The page has nothing above its first line, so pulling up there is a gesture
 * that otherwise does nothing — and the community is drawn as running off the
 * top of the hero, so "up" is where a reader would go looking for the rest.
 *
 * **It is an extra, never the way in.** Nothing on the page says a wheel does
 * this, so the view always has a visible control as well. It is also for a
 * mouse or trackpad only: on a touch screen the same gesture is the browser's
 * pull-to-refresh, and that is not ours to take.
 *
 * Two guards keep it from firing by accident:
 *
 * - The gesture has to **start** at the top. A reader flicking back up the page
 *   arrives there with momentum still coming, and that momentum must not be
 *   read as asking for anything.
 * - It has to be a deliberate pull, `ENTER_PULL` within one gesture, rather
 *   than a single notch of a wheel.
 */
export function useCommunityGesture(args: {
  /** The element that scrolls on a wide frame; the window scrolls otherwise. */
  scroller: RefObject<HTMLElement | null>;
  /** The community view is showing. */
  active: boolean;
  /** Something else owns the page: a dialog, a menu, a departure. */
  disabled: boolean;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const { scroller, active, disabled } = args;
  // The latest callbacks, so the listener is not torn down on every render.
  const handlers = useRef(args);
  handlers.current = args;

  useEffect(() => {
    if (disabled) return;
    if (typeof window.matchMedia !== "function") return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches)
      return;

    let travelled = 0;
    let lastAt = Number.NEGATIVE_INFINITY;
    let startedAtTop = false;

    const onWheel = (event: WheelEvent) => {
      const atTop =
        (scroller.current?.scrollTop ?? 0) <= 0 && window.scrollY <= 0;
      if (event.timeStamp - lastAt > GESTURE_GAP_MS) {
        travelled = 0;
        startedAtTop = atTop;
      }
      lastAt = event.timeStamp;

      if (active) {
        if (event.deltaY <= 0) {
          travelled = 0;
          return;
        }
        travelled += event.deltaY;
        if (travelled >= LEAVE_PUSH) {
          travelled = 0;
          handlers.current.onLeave();
        }
        return;
      }

      if (!startedAtTop || !atTop || event.deltaY >= 0) {
        travelled = 0;
        return;
      }
      travelled -= event.deltaY;
      if (travelled >= ENTER_PULL) {
        travelled = 0;
        handlers.current.onEnter();
      }
    };

    window.addEventListener("wheel", onWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWheel);
  }, [scroller, active, disabled]);
}
