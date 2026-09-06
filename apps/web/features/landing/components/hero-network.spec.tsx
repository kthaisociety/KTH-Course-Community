import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GraphWindow } from "../api/queries";
import { NODE_RADIUS } from "../lib/neighbourhood-view";
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

/**
 * A 2d context that records what was asked of it. jsdom supplies none.
 *
 * `paths` keeps the traced geometry as well as the counts, because a node's
 * *shape* is now an assertion: a diamond is four `lineTo`s and a ring is an
 * `arc` that was stroked rather than filled, and neither is visible from a call
 * count alone. Each entry is one `beginPath()` and everything traced onto it.
 */
type TracedPath = {
  arcs: { x: number; y: number; r: number }[];
  moves: { x: number; y: number }[];
  lines: { x: number; y: number }[];
  closed: boolean;
  filled: boolean;
  stroked: boolean;
  dash: number[];
};

function recordingContext() {
  const calls = { arc: 0, clearRect: 0 };
  const paths: TracedPath[] = [];
  let dash: number[] = [];
  const open = () => paths[paths.length - 1];
  return {
    calls,
    paths,
    ctx: {
      setTransform: vi.fn(),
      clearRect: vi.fn(() => {
        calls.clearRect++;
      }),
      beginPath: vi.fn(() => {
        paths.push({
          arcs: [],
          moves: [],
          lines: [],
          closed: false,
          filled: false,
          stroked: false,
          dash,
        });
      }),
      moveTo: vi.fn((x: number, y: number) => open()?.moves.push({ x, y })),
      lineTo: vi.fn((x: number, y: number) => open()?.lines.push({ x, y })),
      closePath: vi.fn(() => {
        const path = open();
        if (path) path.closed = true;
      }),
      setLineDash: vi.fn((pattern: number[]) => {
        dash = pattern;
      }),
      stroke: vi.fn(() => {
        const path = open();
        if (path) path.stroked = true;
      }),
      fill: vi.fn(() => {
        const path = open();
        if (path) path.filled = true;
      }),
      arc: vi.fn((x: number, y: number, r: number) => {
        calls.arc++;
        open()?.arcs.push({ x, y, r });
      }),
      measureText: vi.fn(() => ({ width: 20 })),
      fillText: vi.fn(),
      roundRect: vi.fn(),
      rect: vi.fn(),
      globalAlpha: 1,
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
      lineCap: "butt",
      font: "",
      textBaseline: "alphabetic",
    } as unknown as CanvasRenderingContext2D,
  };
}

/** A node as the server hands it over, unconfigured on every axis by default. */
function node(over: Partial<GraphWindow["nodes"][number]> = {}) {
  return {
    id: "n",
    x: 0,
    y: 0,
    color: "default",
    style: "default",
    signalStyle: "default",
    isViewer: false,
    ...over,
  };
}

/**
 * World coordinates that land well clear of the hero copy.
 *
 * A node under the copy is faded out and skipped entirely below a clearance of
 * 0.02, so a fixture at the origin draws nothing at all: the projection puts it
 * at the middle of the frame, which is exactly where the headline is. These are
 * far enough out that the keep-out has no say, and the assertions below are
 * therefore about the shape rather than about the fade.
 */
const CLEAR_LEFT = { x: -260, y: 0 };
const CLEAR_RIGHT = { x: 260, y: 0 };

/** A one-node window, so a shape or a signal assertion is about that node. */
function windowOf(over: Partial<GraphWindow["nodes"][number]>): GraphWindow {
  return {
    centre: { x: 0, y: 0 },
    nodes: [node({ ...CLEAR_LEFT, ...over })],
    edges: [],
  };
}

const WINDOW: GraphWindow = {
  centre: { x: 0, y: 0 },
  nodes: [
    node({ id: "a", isViewer: true }),
    node({ id: "b", x: 120, y: 40 }),
    node({ id: "c", x: -90, y: 150 }),
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
   * The keep-out applies to the reveal too.
   *
   * `pushClear` places the viewer's node clear of the copy on any ordinary
   * frame, so this never fires there. It fires when the copy reaches past every
   * edge and there is nowhere inside the push budget to put anybody: the
   * projection hands back `clearance: 0`, the dot is skipped — and the reveal
   * has to go with it. The reveal is a *larger* mark than the node it replaces,
   * so exempting it would put more ink over the headline than skipping the dot
   * just took away.
   */
  it("hides the reveal when the copy leaves the viewer nowhere to stand", () => {
    const { container } = render(
      // The real hero's shape: the canvas inside `[data-hero]`, with a measured
      // content block beside it. The block wraps its text in a child so the
      // per-line measuring path is skipped and the box below is what is read.
      <div data-hero>
        <div data-hero-clear>
          <span>Find the Course You Will Be Happy You Took</span>
        </div>
        <HeroNetwork
          window={windowOf({ isViewer: true, x: 0, y: 0 })}
          labelled={true}
        />
      </div>,
    );
    const canvas = container.querySelector("canvas");
    const hero = container.querySelector<HTMLElement>("[data-hero]");
    const copy = container.querySelector<HTMLElement>("[data-hero-clear]");
    if (!canvas || !hero || !copy) throw new Error("the hero did not render");

    const rect = (x: number, y: number, w: number, h: number) =>
      ({
        x,
        y,
        width: w,
        height: h,
        left: x,
        top: y,
        right: x + w,
        bottom: y + h,
        toJSON: () => ({}),
      }) as DOMRect;
    canvas.getBoundingClientRect = () => rect(0, 0, 320, 220);
    hero.getBoundingClientRect = () => rect(0, 0, 320, 220);

    // Copy reaching further past every edge than `MAX_PUSH` can carry a node.
    copy.getBoundingClientRect = () => rect(-400, -400, 1120, 1020);
    recorder.calls.arc = 0;
    vi.mocked(recorder.ctx.fillText).mockClear();
    onResize?.();

    expect(recorder.calls.arc).toBe(0);
    expect(recorder.ctx.fillText).not.toHaveBeenCalled();

    // …and the converse, so the assertion above is about the keep-out rather
    // than about the scene having quietly failed to build.
    copy.getBoundingClientRect = () => rect(0, 0, 0, 0);
    onResize?.();

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

/**
 * What a node's own appearance draws as.
 *
 * The Landing artboard has no geometry for any of this — its canvas is the older
 * synthetic field where every node is a dot — so these assertions are the
 * specification, not a transcription of one. They are written against the shape
 * rather than the pixel: a diamond is a closed four-sided path, a ring is a
 * stroked circle nothing filled, and a signal is a mark that exists at all.
 */
describe("HeroNetwork draws a node's appearance", () => {
  /**
   * The paths of exactly **one** paint.
   *
   * Mounting paints more than once — the empty scene, then again for the window
   * and the label props — so counting paths across a whole render would count
   * every shape twice and say nothing about what one frame contains. Clearing
   * after mount and driving a single repaint is what makes "one node draws one
   * diamond" a statement that can be false.
   */
  function paintOnce(graphWindow: GraphWindow, labelled = false) {
    render(<HeroNetwork window={graphWindow} labelled={labelled} />);
    recorder.paths.length = 0;
    recorder.ctx.setLineDash = vi.fn(recorder.ctx.setLineDash);
    expect(onResize).toBeTypeOf("function");
    onResize?.();
    return recorder.paths;
  }

  it("fills a dot for the unconfigured style, as it always has", () => {
    const paths = paintOnce(windowOf({ style: "default" }));

    expect(
      paths.filter(
        (path) =>
          path.filled && path.arcs.length === 1 && path.lines.length === 0,
      ),
    ).toHaveLength(1);
  });

  // A ring has to be hollow or it is a dot with extra steps. Nothing may fill it.
  it("strokes a hollow circle for the ring style", () => {
    const circles = paintOnce(windowOf({ style: "ring" })).filter(
      (path) => path.arcs.length === 1,
    );

    expect(circles).toHaveLength(1);
    expect(circles[0].stroked).toBe(true);
    expect(circles[0].filled).toBe(false);
  });

  it("traces four sides and closes them for the diamond style", () => {
    const diamonds = paintOnce(windowOf({ style: "diamond" })).filter(
      (path) => path.lines.length === 3,
    );

    expect(diamonds).toHaveLength(1);
    expect(diamonds[0].moves).toHaveLength(1);
    expect(diamonds[0].closed).toBe(true);
    expect(diamonds[0].filled).toBe(true);
    // No arc at all: a diamond is not a circle with corners drawn over it.
    expect(diamonds[0].arcs).toHaveLength(0);
  });

  it("draws nothing extra when a node carries no signal", () => {
    const paths = paintOnce(windowOf({ signalStyle: "default" }));

    // One path: the node itself. A signal would add at least one more.
    expect(paths).toHaveLength(1);
  });

  it("draws concentric rings, all wider than the node, for the fade signal", () => {
    const rings = paintOnce(windowOf({ signalStyle: "fade" })).filter(
      (path) => path.stroked && path.arcs.length === 1,
    );

    expect(rings.length).toBeGreaterThan(1);
    const radii = rings.map((ring) => ring.arcs[0].r);
    // Strictly widening, and every one of them clear of the dot's own radius.
    expect(radii).toEqual([...radii].sort((a, b) => a - b));
    expect(Math.min(...radii)).toBeGreaterThan(NODE_RADIUS);
  });

  it("draws a broken ring for the dashed signal, and leaves no pattern behind", () => {
    const dashed = paintOnce(windowOf({ signalStyle: "dashed" })).filter(
      (path) => path.dash.length > 0,
    );

    expect(dashed).toHaveLength(1);
    expect(dashed[0].stroked).toBe(true);
    // The pattern is cleared afterwards, or the next node's outline is dashed too.
    expect(recorder.ctx.setLineDash).toHaveBeenLastCalledWith([]);
  });

  /**
   * A comet needs a direction and the only stable one is geometric: away from
   * the middle of the frame, which leans it clear of the hero copy rather than
   * across it. A node to the right of centre must trail off to the right.
   */
  it("trails a comet outward, away from the centre of the frame", () => {
    const segments = paintOnce({
      centre: { x: 0, y: 0 },
      nodes: [node({ id: "n", ...CLEAR_RIGHT, signalStyle: "comet" })],
      edges: [],
    }).filter((path) => path.moves.length === 1 && path.lines.length === 1);

    expect(segments.length).toBeGreaterThan(1);
    for (const segment of segments) {
      // Every segment ends further out than it started.
      expect(segment.lines[0].x).toBeGreaterThan(segment.moves[0].x);
    }
  });

  // The reveal enlarges the node the member has; it does not swap it for a dot.
  it("keeps the viewer's own shape when Find your dot labels it", () => {
    const diamonds = paintOnce(
      windowOf({ isViewer: true, style: "diamond" }),
      true,
    ).filter((path) => path.lines.length === 3 && path.closed);

    // The node itself, and the enlarged one the reveal draws over it.
    expect(diamonds).toHaveLength(2);
  });

  /**
   * The whole canvas rests on painting when an input changes rather than 60
   * times a second, and a signal is the obvious place to break that. Nothing
   * added here animates: a scene with every signal style on it and no label
   * must not arm a frame loop.
   */
  it("never starts a frame loop for a signal, however many are on screen", () => {
    const frame = vi
      .spyOn(window, "requestAnimationFrame")
      .mockReturnValue(1 as unknown as number);
    try {
      render(
        <HeroNetwork
          window={{
            centre: { x: 0, y: 0 },
            nodes: [
              node({ id: "f", ...CLEAR_LEFT, signalStyle: "fade" }),
              node({ id: "c", ...CLEAR_RIGHT, signalStyle: "comet" }),
              node({ id: "d", x: -300, y: 60, signalStyle: "dashed" }),
            ],
            edges: [],
          }}
          labelled={false}
        />,
      );

      expect(frame).not.toHaveBeenCalled();
    } finally {
      frame.mockRestore();
    }
  });

  // The column is free text and the enums may grow. A name this build has never
  // heard of draws as an ordinary node rather than dropping somebody out of a
  // neighbourhood or throwing on their behalf.
  it("draws an unknown style or signal as a plain unconfigured node", () => {
    const paths = paintOnce(
      windowOf({ style: "hexagon", signalStyle: "fireworks" }),
    );

    expect(
      paths.filter((path) => path.filled && path.arcs.length === 1),
    ).toHaveLength(1);
    expect(paths.filter((path) => path.stroked)).toHaveLength(0);
  });
});
