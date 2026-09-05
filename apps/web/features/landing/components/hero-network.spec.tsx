import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HeroNetwork } from "./hero-network";

/**
 * What the hero canvas repaints for.
 *
 * The scene is the real community graph, and a graph of stored world positions
 * does not move — so this canvas is painted on demand rather than 60 times a
 * second, and the pulse on a labelled node is the only thing that ever runs a
 * frame loop. That is the right shape, but it moves the burden: every input
 * `draw()` reads now needs an explicit trigger, and an input without one leaves
 * stale pixels on screen indefinitely rather than for 16ms.
 *
 * These tests are that checklist, executable. Each one names an input and
 * asserts that changing it repaints.
 */

/** A 2d context that records what was asked of it. jsdom supplies none. */
function recordingContext() {
  const calls = { arc: 0, clearRect: 0 };
  return {
    calls,
    ctx: {
      setTransform: vi.fn(),
      clearRect: vi.fn(() => {
        calls.clearRect++;
      }),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      arc: vi.fn(() => {
        calls.arc++;
      }),
      measureText: vi.fn(() => ({ width: 20 })),
      fillText: vi.fn(),
      roundRect: vi.fn(),
      rect: vi.fn(),
      globalAlpha: 1,
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
      font: "",
      textBaseline: "alphabetic",
    } as unknown as CanvasRenderingContext2D,
  };
}

const WINDOW = {
  centre: { x: 0, y: 0 },
  nodes: [
    { id: "a", x: 0, y: 0, color: "default", isViewer: true },
    { id: "b", x: 120, y: 40, color: "default", isViewer: false },
    { id: "c", x: -90, y: 150, color: "default", isViewer: false },
  ],
  edges: [
    { fromId: "b", toId: "a" },
    { fromId: "c", toId: "a" },
  ],
};

let recorder: ReturnType<typeof recordingContext>;
/** The callback the scene hands to its ResizeObserver, so a test can fire it. */
let onResize: (() => void) | null;
/** Resolves the stand-in `document.fonts.ready`, on the test's cue. */
let loadFonts: () => void;
let realGetContext: HTMLCanvasElement["getContext"];
let realMatchMedia: typeof window.matchMedia;

beforeEach(() => {
  recorder = recordingContext();
  onResize = null;
  realGetContext = HTMLCanvasElement.prototype.getContext;
  realMatchMedia = window.matchMedia;
  // jsdom has no ResizeObserver, and the scene prefers one over the window
  // event. Standing one up is what lets the resize path be driven honestly.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        onResize = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => recorder.ctx,
  ) as unknown as HTMLCanvasElement["getContext"];
  // The scene asks for `prefers-reduced-motion` before it builds itself, and
  // jsdom's own `matchMedia` is only stood up by `vitest.setup.ts` when absent.
  // Answering "no preference" keeps the pulse in scope for these tests.
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;
  // jsdom implements no FontFaceSet, so the scene's `document.fonts?.` simply
  // short-circuits there. A promise the test resolves by hand is what lets the
  // font-swap path be driven rather than assumed.
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: {
      ready: new Promise<void>((resolve) => {
        loadFonts = resolve;
      }),
    },
  });
});

afterEach(() => {
  document.documentElement.className = "";
  document.documentElement.removeAttribute("data-cc-theme");
  document.documentElement.removeAttribute("style");
  HTMLCanvasElement.prototype.getContext = realGetContext;
  window.matchMedia = realMatchMedia;
  Reflect.deleteProperty(document, "fonts");
});

/** Let a MutationObserver callback, which runs as a microtask, land. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("HeroNetwork repaints when", () => {
  // The reported bug. Every colour is a `--cc-*` token resolved at draw time,
  // so already-rasterised pixels keep the old palette until something redraws.
  // This is how the theme actually flips today: `next-themes` is configured
  // with `attribute="class"` and writes `.dark` onto the root element.
  it("the theme class lands on the root element", async () => {
    render(<HeroNetwork window={WINDOW} labelled={false} />);
    const painted = recorder.calls.arc;
    expect(painted).toBeGreaterThan(0);

    document.documentElement.classList.add("dark");
    await settle();

    expect(recorder.calls.arc).toBeGreaterThan(painted);
  });

  // …and this is every other way the root could carry a palette: the
  // `data-cc-theme` attribute the design uses, `next-themes`' own `data-theme`
  // default, the `style.colorScheme` it writes alongside the class, or a token
  // overridden inline. The watcher is deliberately unfiltered so that swapping
  // the mechanism in `app/layout.tsx` cannot silently strand this canvas.
  it("the root carries its theme some other way", async () => {
    render(<HeroNetwork window={WINDOW} labelled={false} />);
    const painted = recorder.calls.arc;

    document.documentElement.setAttribute("data-cc-theme", "dark");
    await settle();
    expect(recorder.calls.arc).toBeGreaterThan(painted);

    const afterAttribute = recorder.calls.arc;
    document.documentElement.style.setProperty("--cc-brand", "#d7e3f7");
    await settle();
    expect(recorder.calls.arc).toBeGreaterThan(afterAttribute);
  });

  it("the graph it was given changes", () => {
    const { rerender } = render(
      <HeroNetwork window={WINDOW} labelled={false} />,
    );
    const painted = recorder.calls.arc;

    rerender(
      <HeroNetwork
        window={{ ...WINDOW, centre: { x: 500, y: 500 } }}
        labelled={false}
      />,
    );

    expect(recorder.calls.arc).toBeGreaterThan(painted);
  });

  it("the viewer's node gains its label", () => {
    const { rerender } = render(
      <HeroNetwork window={WINDOW} labelled={false} />,
    );
    const painted = recorder.calls.arc;

    rerender(<HeroNetwork window={WINDOW} labelled={true} />);

    expect(recorder.calls.arc).toBeGreaterThan(painted);
  });

  // The keep-out is measured off `getClientRects()` of the real lines, so it is
  // only true for the face that was rendering when it was measured. A fallback
  // swapping to Geist reflows the copy without necessarily resizing the section.
  it("the web font finishes loading", async () => {
    render(<HeroNetwork window={WINDOW} labelled={false} />);
    const cleared = recorder.calls.clearRect;

    loadFonts();
    await settle();

    expect(recorder.calls.clearRect).toBeGreaterThan(cleared);
  });

  it("the frame is resized", () => {
    render(<HeroNetwork window={WINDOW} labelled={false} />);
    const cleared = recorder.calls.clearRect;

    expect(onResize).toBeTypeOf("function");
    onResize?.();

    expect(recorder.calls.clearRect).toBeGreaterThan(cleared);
  });
});

describe("HeroNetwork", () => {
  // The graph is on screen before anybody asks for it. What Find your dot adds
  // is the label, and until it succeeds there is no label to draw.
  it("draws the community without labelling anybody", () => {
    render(<HeroNetwork window={WINDOW} labelled={false} />);

    expect(recorder.calls.arc).toBeGreaterThan(0);
    expect(recorder.ctx.fillText).not.toHaveBeenCalled();
  });

  it("labels the viewer's own node once the flow has found it", () => {
    render(<HeroNetwork window={WINDOW} labelled={true} />);

    expect(recorder.ctx.fillText).toHaveBeenCalledWith(
      "You",
      expect.any(Number),
      expect.any(Number),
    );
  });

  /**
   * Competing motion is the biggest tell in a shared-element transition, so for
   * the length of the landing → Explore handoff the only thing that moves is the
   * layout. The pulse is the only animation this canvas ever runs.
   */
  it("stops the pulse while the page is handing itself over to Explore", () => {
    const frame = vi
      .spyOn(window, "requestAnimationFrame")
      .mockReturnValue(1 as unknown as number);
    const cancel = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => {});
    try {
      const { rerender } = render(
        <HeroNetwork window={WINDOW} labelled={true} />,
      );
      expect(frame).toHaveBeenCalled();

      rerender(<HeroNetwork window={WINDOW} labelled={true} paused={true} />);

      expect(cancel).toHaveBeenCalledWith(1);
    } finally {
      frame.mockRestore();
      cancel.mockRestore();
    }
  });

  it("never starts a pulse for a label that arrives while it is paused", () => {
    const frame = vi
      .spyOn(window, "requestAnimationFrame")
      .mockReturnValue(1 as unknown as number);
    try {
      render(<HeroNetwork window={WINDOW} labelled={true} paused={true} />);

      expect(frame).not.toHaveBeenCalled();
    } finally {
      frame.mockRestore();
    }
  });

  // An empty community is an empty hero. Nothing here may invent a node.
  it("draws nothing at all for an empty community", () => {
    render(
      <HeroNetwork
        window={{ centre: { x: 0, y: 0 }, nodes: [], edges: [] }}
        labelled={false}
      />,
    );
    expect(recorder.calls.arc).toBe(0);
  });

  it("survives a browser with no 2d context, because the hero is decoration", () => {
    HTMLCanvasElement.prototype.getContext = vi.fn(
      () => null,
    ) as unknown as HTMLCanvasElement["getContext"];
    expect(() =>
      render(<HeroNetwork window={WINDOW} labelled={false} />),
    ).not.toThrow();
  });

  // `fonts.ready` cannot be cancelled, so the only thing standing between a slow
  // font and a torn-down scene is the effect's own flag.
  it("stops relayouting for a font that lands after it is gone", async () => {
    const { unmount } = render(
      <HeroNetwork window={WINDOW} labelled={false} />,
    );
    unmount();
    const cleared = recorder.calls.clearRect;

    loadFonts();
    await settle();

    expect(recorder.calls.clearRect).toBe(cleared);
  });

  it("stops watching the root once it is gone", async () => {
    const { unmount } = render(
      <HeroNetwork window={WINDOW} labelled={false} />,
    );
    unmount();
    const painted = recorder.calls.arc;

    document.documentElement.classList.add("dark");
    await settle();

    expect(recorder.calls.arc).toBe(painted);
  });
});
