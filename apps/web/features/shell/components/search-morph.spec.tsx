import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { StrictMode, useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SEARCH_MORPH_KEY,
  SEARCH_MORPH_MAX_AGE_MS,
  stashSearchBarHandoff,
} from "../lib/search-morph";
import { SearchMorphProvider, useSearchBarArrival } from "./search-morph";

/**
 * What is worth asserting here is the *invert* step, not the animation.
 *
 * FLIP's correctness is entirely in the offset written before the browser
 * paints: the bar starts where the landing left it, the rail starts a full rail
 * width to the left, and the surroundings start invisible. Whether a spring then
 * takes 340ms or 360ms to bring all three home is a taste question no test
 * should own — but *whether the offset is applied at all* is the difference
 * between continuing a gesture and inventing one, and every rule about that is
 * checked below.
 */

const reduceMotion = vi.fn(() => false);

vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("motion/react")>()),
  useReducedMotion: () => reduceMotion(),
}));

/** Where the bar and the rail come to rest on Explore, in jsdom's flat world. */
const RESTING: Record<string, DOMRect> = {
  bar: rect({ left: 320, top: 20, width: 560, height: 42 }),
  rail: rect({ left: 0, top: 0, width: 236, height: 800 }),
};

/** Where the landing's bar was standing: centred in the viewport, far lower. */
const LANDING_BAR = { left: 140, top: 400, width: 560, height: 42 };

function rect(box: {
  left: number;
  top: number;
  width: number;
  height: number;
}): DOMRect {
  return {
    ...box,
    x: box.left,
    y: box.top,
    right: box.left + box.width,
    bottom: box.top + box.height,
    toJSON: () => box,
  } as DOMRect;
}

/**
 * jsdom lays nothing out, so every rect is zero and the hook would refuse to
 * animate an unmeasurable bar. The elements under test are given the boxes they
 * would have in a browser, keyed off their test ids.
 */
function layOut() {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function boundingRect(this: Element) {
      const id = this.getAttribute("data-testid") ?? "";
      return RESTING[id] ?? rect({ left: 0, top: 0, width: 0, height: 0 });
    },
  );
}

/** A page that receives the handoff, standing in for Explore. */
function ArrivingPage() {
  const barRef = useRef<HTMLFormElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  useSearchBarArrival(barRef, rootRef);

  return (
    <div ref={rootRef}>
      <form ref={barRef} data-testid="bar" />
      <div data-cc-fade data-testid="surroundings" />
    </div>
  );
}

/** The shell around it, publishing its rail exactly as `AppShell` does. */
function Shell({ children }: { children: ReactNode }) {
  const railRef = useRef<HTMLElement | null>(null);
  return (
    <SearchMorphProvider railRef={railRef}>
      <aside ref={railRef} data-testid="rail" />
      {children}
    </SearchMorphProvider>
  );
}

const bar = () => screen.getByTestId("bar");
const rail = () => screen.getByTestId("rail");
const surroundings = () => screen.getByTestId("surroundings");

beforeEach(() => {
  window.sessionStorage.clear();
  reduceMotion.mockReturnValue(false);
  layOut();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useSearchBarArrival", () => {
  describe("continuing a search submitted on the landing page", () => {
    beforeEach(() => {
      stashSearchBarHandoff(LANDING_BAR);
    });

    it("starts the bar in the box the landing left it in", () => {
      render(
        <Shell>
          <ArrivingPage />
        </Shell>,
      );

      // 140 - 320 to the left, 400 - 20 down: the bar has to travel up and to
      // the right, which is what makes this a rise rather than a fade.
      expect(bar().style.transform).toBe("translate3d(-180px, 380px, 0)");
    });

    it("starts the rail a full rail width off the left edge", () => {
      render(
        <Shell>
          <ArrivingPage />
        </Shell>,
      );

      expect(rail().style.transform).toBe("translate3d(-236px, 0, 0)");
    });

    it("starts the surroundings invisible, to come up behind the bar", () => {
      render(
        <Shell>
          <ArrivingPage />
        </Shell>,
      );

      expect(surroundings().style.opacity).toBe("0");
    });

    it("consumes the handoff, so a reload of Explore replays nothing", () => {
      const { unmount } = render(
        <Shell>
          <ArrivingPage />
        </Shell>,
      );
      expect(window.sessionStorage.getItem(SEARCH_MORPH_KEY)).toBeNull();
      unmount();

      render(
        <Shell>
          <ArrivingPage />
        </Shell>,
      );

      expect(bar().style.transform).toBe("");
      expect(rail().style.transform).toBe("");
    });

    /**
     * React replays every effect on mount under Strict Mode — run, clean up,
     * run — and Next turns it on in development. Guarding the destructive read
     * and the animation with one flag would let the first pass consume the rect
     * and start the spring, let the cleanup stop it, and then refuse to start it
     * again: no arrival at all, in the one build a developer looks at.
     */
    it("still animates when React replays the effect under Strict Mode", () => {
      render(
        <StrictMode>
          <Shell>
            <ArrivingPage />
          </Shell>
        </StrictMode>,
      );

      expect(bar().style.transform).toBe("translate3d(-180px, 380px, 0)");
      expect(rail().style.transform).toBe("translate3d(-236px, 0, 0)");
    });

    it("moves the bar even where the shell has published no rail", () => {
      render(<ArrivingPage />);

      expect(bar().style.transform).toBe("translate3d(-180px, 380px, 0)");
    });

    it("leaves the rail alone when the frame is too narrow to show one", () => {
      // `hidden @3xl/shell:block` keeps the rail in the DOM at zero width, which
      // is what it measures as here when it is given no resting box.
      delete RESTING.rail;
      try {
        render(
          <Shell>
            <ArrivingPage />
          </Shell>,
        );

        expect(bar().style.transform).toBe("translate3d(-180px, 380px, 0)");
        expect(rail().style.transform).toBe("");
      } finally {
        RESTING.rail = rect({ left: 0, top: 0, width: 236, height: 800 });
      }
    });
  });

  describe("arriving any other way", () => {
    it("animates nothing when there is no handoff at all", () => {
      render(
        <Shell>
          <ArrivingPage />
        </Shell>,
      );

      expect(bar().style.transform).toBe("");
      expect(rail().style.transform).toBe("");
      expect(surroundings().style.opacity).toBe("");
    });

    it("animates nothing from a rect that has gone stale", () => {
      stashSearchBarHandoff(
        LANDING_BAR,
        Date.now() - SEARCH_MORPH_MAX_AGE_MS - 1,
      );

      render(
        <Shell>
          <ArrivingPage />
        </Shell>,
      );

      expect(bar().style.transform).toBe("");
      expect(window.sessionStorage.getItem(SEARCH_MORPH_KEY)).toBeNull();
    });

    it("animates nothing when the bar landed where it already stood", () => {
      stashSearchBarHandoff({ ...RESTING.bar });

      render(
        <Shell>
          <ArrivingPage />
        </Shell>,
      );

      expect(bar().style.transform).toBe("");
    });
  });

  describe("under prefers-reduced-motion", () => {
    it("animates nothing, and still consumes the handoff", () => {
      reduceMotion.mockReturnValue(true);
      stashSearchBarHandoff(LANDING_BAR);

      render(
        <Shell>
          <ArrivingPage />
        </Shell>,
      );

      expect(bar().style.transform).toBe("");
      expect(rail().style.transform).toBe("");
      expect(surroundings().style.opacity).toBe("");
      // Consumed rather than left behind: a reader who turns reduced motion off
      // and reloads must not inherit the rect this navigation did not use.
      expect(window.sessionStorage.getItem(SEARCH_MORPH_KEY)).toBeNull();
    });
  });
});
