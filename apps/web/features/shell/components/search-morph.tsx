"use client";

import { animate, useMotionValue, useReducedMotion } from "motion/react";
import type { ReactNode, RefObject } from "react";
import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { takeSearchBarHandoff } from "@/features/shell/lib/search-morph";

/**
 * The receiving half of the landing → Explore transition: the search bar
 * arriving, and the rail arriving with it.
 *
 * ## Why the shell owns this
 *
 * The gesture spans three features. The landing measures the bar, Explore
 * renders the bar it turns into, and the rail — the other half of the movement —
 * belongs to `AppShell`. Explore cannot reach into the shell's chrome and the
 * shell cannot know where Explore's bar came to rest, so the shell publishes the
 * one thing Explore is missing (the rail element) and Explore hands back the one
 * thing the shell is missing (its own bar), and the animation is written once,
 * here, over both.
 *
 * ## One spring, two elements
 *
 * `arrival` runs 0 → 1 on a single spring and *both* offsets are read off it. It
 * is not two animations that happen to share a config and start in the same
 * frame; it is one number, and the bar's remaining travel and the rail's
 * remaining travel are two views of it.
 *
 * That matters because the two motions are causally related rather than merely
 * simultaneous. The bar centres in the viewport on the landing and in the space
 * *beside* the rail on Explore, so its resting centre sits about half a rail
 * width further right: the horizontal half of the bar's travel is the rail's
 * arrival, measured. Driving them from one value is how that reads as a single
 * gesture instead of two things starting at once — and the horizontal component
 * is never assumed, because `dx` is the difference between two rects that were
 * actually measured.
 *
 * ## Why the offsets are written to the node
 *
 * `useLayoutEffect` runs after React has committed the DOM and before the
 * browser paints, so the "invert" step of FLIP is set straight on the element
 * there. Going through a motion value or through React state instead would put
 * the first offset on Motion's own frame loop, one `requestAnimationFrame`
 * later — which is a full frame of the bar standing at its destination before it
 * jumps back to travel. That single frame is the thing that makes a handoff look
 * synthetic, and it is exactly what the artboard's blind `setTimeout` never
 * quite avoids.
 *
 * Everything else — the actual travel — is Motion's.
 */

/**
 * The travel.
 *
 * ζ = 30 / (2·√300) ≈ 0.87, so the overshoot is about 0.4%: on a ~350px rise
 * that is a pixel and a half, which reads as a settle rather than a bounce. The
 * bar is a piece of page furniture arriving where it belongs, not a toy — a
 * springier ratio (ζ ≈ 0.75 would overshoot by ~10px here) makes the top of the
 * page look loose.
 *
 * ω = √300 ≈ 17.3 rad/s puts the 0.5% settling time at 5.3/(ζω) ≈ 355ms. Long
 * enough to be legible as a movement, short enough that the reader is not
 * waiting for their results.
 *
 * The rest thresholds are set rather than left to Motion, because Motion picks
 * them from the size of the value it is animating: a 0 → 1 progress is under its
 * granular cutoff, so it would stop at `restDelta` 0.005 — which is 0.005 of the
 * travel, close to two pixels on that rise, and `onComplete` would then snap the
 * remainder. Scaling both down by the same order the value is puts the stopping
 * point back under a third of a pixel, where it belongs.
 */
export const SEARCH_MORPH_SPRING = {
  type: "spring",
  stiffness: 300,
  damping: 30,
  mass: 1,
  restDelta: 0.001,
  restSpeed: 0.01,
} as const;

/**
 * How far into the arrival the surroundings have finished fading in.
 *
 * The bar and the rail are the only things that *move*; everything else on
 * Explore was not on the landing at all and simply appears. Appearing all at
 * once, at full strength, under a bar that is still travelling is the same
 * competing-motion problem as leaving the hero graph running — so the page
 * behind the bar comes up over the first part of the travel and is settled well
 * before the bar is, which puts the reader's eye on the bar rather than on the
 * page arriving.
 */
const SURROUNDINGS_IN = 0.55;

/** Everything Explore marks as arriving behind the bar. The artboard's own attribute. */
const FADE_SELECTOR = "[data-cc-fade]";

type SearchMorphFrame = {
  /**
   * The shell's rail. Non-null whenever the shell is mounted — the element is
   * in the DOM at every width — so whether it *shows* is a question for its
   * measured width, not for this ref.
   */
  railRef: RefObject<HTMLElement | null>;
};

const SearchMorphContext = createContext<SearchMorphFrame | null>(null);

/**
 * Publishes the shell's rail to whichever route is animating in.
 *
 * Rendered by `AppShell` around its own children, so a page reaches the rail
 * through a context the shell chose to expose rather than by querying for
 * chrome it does not own.
 */
export function SearchMorphProvider({
  railRef,
  children,
}: {
  railRef: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  const frame = useMemo(() => ({ railRef }), [railRef]);
  return (
    <SearchMorphContext.Provider value={frame}>
      {children}
    </SearchMorphContext.Provider>
  );
}

/**
 * Continue the landing's search bar, if that is what this mount is.
 *
 * Does nothing at all — no measurement, no style, no frame of work — when there
 * is no handoff to continue. Arriving at `/search` from a shared link, a
 * bookmark or the rail is not a gesture anybody made, so it gets no animation.
 *
 * @param barRef the page's own search bar, the element the landing's rect
 *   corresponds to.
 * @param fadeRootRef the subtree to look inside for `[data-cc-fade]`: the
 *   regions that were not on the landing and should come up behind the bar.
 */
export function useSearchBarArrival(
  barRef: RefObject<HTMLElement | null>,
  fadeRootRef?: RefObject<HTMLElement | null>,
): void {
  const frame = useContext(SearchMorphContext);
  const railRef = frame?.railRef;
  const reduceMotion = useReducedMotion();
  const arrival = useMotionValue(1);
  const spent = useRef(false);

  useLayoutEffect(() => {
    // One mount, one handoff. The guard is a ref rather than an empty
    // dependency array because this effect both reads storage destructively and
    // starts an animation: re-running it would replay a gesture the reader has
    // already finished, and a dependency array only promises not to re-run when
    // every identity it lists happens to hold still.
    if (spent.current) return;
    spent.current = true;

    // Read first, decide second. The handoff is consumed even when it is not
    // used — under reduced motion, or with no bar to move — so a rect can never
    // outlive the navigation that produced it.
    const handoff = takeSearchBarHandoff();
    if (!handoff || reduceMotion) return;

    const bar = barRef.current;
    if (!bar) return;
    const to = bar.getBoundingClientRect();
    if (!to.width || !to.height) return;

    const dx = handoff.x - to.left;
    const dy = handoff.y - to.top;
    // The bar arrived where it was already standing. There is nothing to draw,
    // and a spring over nothing is a few frames of work for an unchanging
    // picture.
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;

    const rail = railRef?.current ?? null;
    // `hidden @3xl/shell:block` leaves the rail in the DOM at zero width on a
    // narrow frame. Measuring is how we learn that without restating the
    // breakpoint here — and a rail nobody can see does not slide in.
    const railWidth = rail?.getBoundingClientRect().width ?? 0;
    const sliding = rail && railWidth > 0 ? rail : null;

    const fading = fadeRootRef?.current
      ? Array.from(
          fadeRootRef.current.querySelectorAll<HTMLElement>(FADE_SELECTOR),
        )
      : [];

    const paint = (progress: number) => {
      const away = 1 - progress;
      bar.style.transform = `translate3d(${dx * away}px, ${dy * away}px, 0)`;
      if (sliding) {
        sliding.style.transform = `translate3d(${-railWidth * away}px, 0, 0)`;
      }
      const opacity = Math.min(1, progress / SURROUNDINGS_IN);
      for (const element of fading) element.style.opacity = String(opacity);
    };

    // The invert step, before the browser has painted a single frame of any of
    // this at rest.
    bar.style.willChange = "transform";
    if (sliding) sliding.style.willChange = "transform";
    paint(0);

    const settle = () => {
      bar.style.transform = "";
      bar.style.willChange = "";
      if (sliding) {
        sliding.style.transform = "";
        sliding.style.willChange = "";
      }
      for (const element of fading) element.style.opacity = "";
    };

    arrival.jump(0);
    const unsubscribe = arrival.on("change", paint);
    const controls = animate(arrival, 1, {
      ...SEARCH_MORPH_SPRING,
      // Hand the elements back to the stylesheet the moment the spring is done,
      // so nothing carries an inline transform or a `will-change` compositor
      // hint for the rest of the session.
      onComplete: settle,
    });

    return () => {
      controls.stop();
      unsubscribe();
      settle();
    };
  }, [arrival, barRef, fadeRootRef, railRef, reduceMotion]);
}
