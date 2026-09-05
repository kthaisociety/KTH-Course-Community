import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TRPCClientError } from "@trpc/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SEARCH_MORPH_KEY } from "@/features/shell/lib/search-morph";
import { Landing } from "./landing";

const push = vi.fn();
const prefetch = vi.fn();
const replace = vi.fn();
const logout = vi.fn();
const setTheme = vi.fn();
const useSessionData = vi.fn();
const useNeighbourhood = vi.fn();
const usePublicWindow = vi.fn();
const sendMagicLink = vi.fn();

let search = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, prefetch, replace }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(search),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light", setTheme }),
}));

// The one hook the departure is gated on. Motion reads the media query once, at
// module scope, so the preference is faked at the hook rather than at
// `matchMedia` — otherwise it would be fixed by whichever suite loaded first.
const reduceMotion = vi.fn(() => false);

vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("motion/react")>()),
  useReducedMotion: () => reduceMotion(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: { magicLink: (...args: unknown[]) => sendMagicLink(...args) },
  },
}));

// Only the session hooks are faked; AuthReasonDialog stays real.
vi.mock("@/features/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/auth")>()),
  useSessionData: () => useSessionData(),
  useLogout: () => logout,
}));

// `isUnplaced` stays real — how "unplaced" is recognised is the point of the
// state, so a test that stubbed it would prove nothing.
vi.mock("../api/queries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/queries")>()),
  useNeighbourhood: (enabled: boolean) => useNeighbourhood(enabled),
  usePublicWindow: (enabled: boolean) => usePublicWindow(enabled),
}));

/**
 * The account behind the session is gone. `graph.neighbourhood` places an app
 * user who has no node rather than refusing them, so this is the only way a
 * member still reaches the "unplaced" panel.
 */
function notFound() {
  return TRPCClientError.from({
    error: {
      code: -32004,
      message: "No community graph node for app user u1",
      data: { code: "NOT_FOUND" },
    },
  });
}

function graphState(over: Record<string, unknown> = {}) {
  return {
    data: undefined,
    error: null,
    isSuccess: false,
    isError: false,
    refetch: vi.fn(),
    ...over,
  };
}

/**
 * A bounded window as the server hands it over: opaque per-response ids, no user
 * id anywhere, and one node flagged as the viewer's.
 */
const NEIGHBOURHOOD = {
  centre: { x: 0, y: 0 },
  nodes: [
    { id: "t-1", x: 0, y: 0, color: "default", isViewer: true },
    { id: "t-2", x: 240, y: -120, color: "default", isViewer: false },
  ],
  edges: [{ fromId: "t-1", toId: "t-2" }],
  effectiveTier: 1,
};

/** The same graph, as a visitor gets it: centred on the origin, with no You. */
const PUBLIC_WINDOW = {
  centre: { x: 0, y: 0 },
  nodes: [
    { id: "p-1", x: 0, y: 0, color: "default", isViewer: false },
    { id: "p-2", x: 240, y: -120, color: "default", isViewer: false },
  ],
  edges: [{ fromId: "p-1", toId: "p-2" }],
};

function visitor() {
  useSessionData.mockReturnValue({ user: null, isPending: false });
}

function member(name = "Elsa Lindqvist") {
  useSessionData.mockReturnValue({
    user: { name, email: "elsa@kth.se" },
    isPending: false,
  });
}

beforeEach(() => {
  search = "";
  visitor();
  useNeighbourhood.mockReturnValue(graphState());
  usePublicWindow.mockReturnValue(
    graphState({ data: PUBLIC_WINDOW, isSuccess: true }),
  );
  sendMagicLink.mockResolvedValue({ error: null });
  // jsdom has no 2d context. The hero is decoration, so the page must render
  // without one rather than throw.
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as never;
  reduceMotion.mockReturnValue(false);
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * jsdom lays nothing out, so the search bar measures as a zero-sized box and the
 * page falls back to a plain navigation — which is correct behaviour and exactly
 * what the departure must not be tested through. This gives the bar the box it
 * would have in a browser.
 */
const LANDING_BAR = { left: 140, top: 400, width: 560, height: 42 };

function layOutTheBar() {
  vi.spyOn(
    HTMLFormElement.prototype,
    "getBoundingClientRect",
  ).mockImplementation(
    () =>
      ({
        ...LANDING_BAR,
        x: LANDING_BAR.left,
        y: LANDING_BAR.top,
        right: LANDING_BAR.left + LANDING_BAR.width,
        bottom: LANDING_BAR.top + LANDING_BAR.height,
        toJSON: () => LANDING_BAR,
      }) as DOMRect,
  );
}

function searchField() {
  return screen.getByLabelText(/search a course, code or subject/i);
}

function stashed() {
  const raw = window.sessionStorage.getItem(SEARCH_MORPH_KEY);
  return raw === null ? null : JSON.parse(raw);
}

function openFindYourDot(user: ReturnType<typeof userEvent.setup>) {
  return user.click(screen.getByRole("button", { name: /find your dot/i }));
}

/**
 * The landing's own bar. Its sign-in buttons and the card at the foot of a
 * narrow page carry the same labels, and only a container query tells them
 * apart — which jsdom has no layout to answer.
 */
function header() {
  return within(screen.getByRole("banner"));
}

describe("Landing", () => {
  describe("a visitor", () => {
    it("keeps the header mark legible in each theme", () => {
      render(<Landing />);

      expect(screen.getByTestId("landing-mark-light")).toHaveAttribute(
        "src",
        "/ais-symbol-blue.png",
      );
      expect(screen.getByTestId("landing-mark-light")).toHaveClass(
        "dark:hidden",
      );
      expect(screen.getByTestId("landing-mark-dark")).toHaveAttribute(
        "src",
        "/ais-symbol-white.png",
      );
      expect(screen.getByTestId("landing-mark-dark")).toHaveClass("dark:block");
    });

    it("uses the artboard's full-height desktop composition", () => {
      const { container } = render(<Landing />);
      expect(container.firstElementChild).toHaveClass(
        "lg:h-dvh",
        "lg:overflow-y-auto",
      );
    });

    it("gets the whole page without an account", () => {
      render(<Landing />);
      expect(
        screen.getByRole("heading", {
          name: /find the course you will be happy you took/i,
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText(/search a course, code or subject/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Every KTH course, one field"),
      ).toBeInTheDocument();
      expect(screen.getByText("Numbers, not vibes")).toBeInTheDocument();
      expect(screen.getByText("Write first, sign in last")).toBeInTheDocument();
    });

    // #68 settled that no AI comparison feature exists, so the landing must not
    // promise one.
    it("promises nothing the app does not have", () => {
      render(<Landing />);
      expect(screen.queryByText(/with ai/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/compare/i)).not.toBeInTheDocument();
    });

    // The hero is the real community for everybody. A visitor cannot ask the
    // protected read, so they get the public window instead — and they get it
    // on load, without asking for anything.
    it("draws the real community without a session", () => {
      render(<Landing />);
      expect(useNeighbourhood).toHaveBeenCalledWith(false);
      expect(usePublicWindow).toHaveBeenCalledWith(true);
    });

    it("hands a typed search over to Explore", async () => {
      const user = userEvent.setup();
      render(<Landing />);
      await user.type(searchField(), "graph theory{Enter}");
      await waitFor(() =>
        expect(push).toHaveBeenCalledWith("/search?q=graph%20theory"),
      );
    });

    it("hands a suggestion over the same way", async () => {
      const user = userEvent.setup();
      render(<Landing />);
      await user.click(screen.getByRole("button", { name: "DD2380" }));
      await waitFor(() =>
        expect(push).toHaveBeenCalledWith("/search?q=DD2380"),
      );
    });

    it("goes nowhere on an empty search", async () => {
      const user = userEvent.setup();
      render(<Landing />);
      await user.type(searchField(), "   {Enter}");
      expect(push).not.toHaveBeenCalled();
      expect(stashed()).toBeNull();
    });

    /**
     * The departure half of the landing → Explore transition. What the bar does
     * *after* the navigation belongs to the shell
     * (`features/shell/components/search-morph.spec.tsx`); what this page owes
     * it is a rect, measured at the moment of submit, and a navigation that
     * waits for the page to have cleared out of the bar's way.
     */
    describe("leaving for Explore", () => {
      it("hands Explore the box the bar was standing in", async () => {
        layOutTheBar();
        const user = userEvent.setup();
        render(<Landing />);

        await user.type(searchField(), "graph theory{Enter}");

        expect(stashed()).toMatchObject({ x: 140, y: 400, w: 560, h: 42 });
        expect(stashed().t).toBeTypeOf("number");
      });

      it("waits for the exit to finish before it navigates", async () => {
        layOutTheBar();
        const user = userEvent.setup();
        render(<Landing />);

        await user.type(searchField(), "graph theory{Enter}");

        // The artboard fires a blind `setTimeout(130)` here. The push is hung
        // off the exit animation actually completing instead, so it has not
        // happened yet — but it does happen, without anything else prompting it.
        expect(push).not.toHaveBeenCalled();
        await waitFor(() =>
          expect(push).toHaveBeenCalledWith("/search?q=graph%20theory"),
        );
        expect(push).toHaveBeenCalledTimes(1);
      });

      it("ignores a second submit while it is already leaving", async () => {
        layOutTheBar();
        const user = userEvent.setup();
        render(<Landing />);

        await user.type(searchField(), "graph theory{Enter}");
        const first = stashed();
        await user.click(screen.getByRole("button", { name: "DD2380" }));

        expect(stashed()).toEqual(first);
        await waitFor(() =>
          expect(push).toHaveBeenCalledWith("/search?q=graph%20theory"),
        );
        expect(push).toHaveBeenCalledTimes(1);
      });

      it("prefetches Explore once, when the field is focused", async () => {
        const user = userEvent.setup();
        render(<Landing />);

        await user.click(searchField());
        await user.click(document.body);
        await user.click(searchField());

        expect(prefetch).toHaveBeenCalledExactlyOnceWith("/search");
      });

      it("navigates plainly, and hands nothing over, under reduced motion", async () => {
        reduceMotion.mockReturnValue(true);
        layOutTheBar();
        const user = userEvent.setup();
        render(<Landing />);

        await user.type(searchField(), "graph theory{Enter}");

        expect(push).toHaveBeenCalledWith("/search?q=graph%20theory");
        expect(stashed()).toBeNull();
      });

      it("clears a rect left over from an earlier submit when it navigates plainly", async () => {
        window.sessionStorage.setItem(
          SEARCH_MORPH_KEY,
          JSON.stringify({ x: 1, y: 2, w: 560, h: 42, t: Date.now() }),
        );
        reduceMotion.mockReturnValue(true);
        layOutTheBar();
        const user = userEvent.setup();
        render(<Landing />);

        await user.type(searchField(), "graph theory{Enter}");

        expect(stashed()).toBeNull();
      });

      it("navigates plainly when the bar has no box to hand over", async () => {
        // No `layOutTheBar()`: jsdom measures every element as zero, which is
        // the same shape as a bar that is not on screen. There is no rect worth
        // continuing, so the page does what it always did.
        const user = userEvent.setup();
        render(<Landing />);

        await user.type(searchField(), "graph theory{Enter}");

        expect(push).toHaveBeenCalledWith("/search?q=graph%20theory");
        expect(stashed()).toBeNull();
      });
    });

    it("opens the sign-in dialog from the header", async () => {
      const user = userEvent.setup();
      render(<Landing />);
      await user.click(header().getByRole("button", { name: "Sign up" }));
      await waitFor(() =>
        expect(
          screen.getByRole("heading", { name: /create your account/i }),
        ).toBeInTheDocument(),
      );
    });

    describe("find your dot", () => {
      it("asks for an account, because a dot belongs to one", async () => {
        const user = userEvent.setup();
        render(<Landing />);
        await openFindYourDot(user);
        expect(
          await screen.findByText(/find your place in the community/i),
        ).toBeInTheDocument();
        expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      });

      it("refuses an address that cannot be one, and sends nothing", async () => {
        const user = userEvent.setup();
        render(<Landing />);
        await openFindYourDot(user);
        await user.type(await screen.findByLabelText(/email address/i), "nope");
        await user.click(
          screen.getByRole("button", { name: /send private link/i }),
        );
        expect(
          await screen.findByText(/enter a valid email address/i),
        ).toBeInTheDocument();
        expect(sendMagicLink).not.toHaveBeenCalled();
      });

      // Greptile reproduced this: a rejected request used to leave "Sending…"
      // standing over a form that could never be submitted again, and closing
      // the dialog did not clear it either.
      it("gets its form back when the request never goes through", async () => {
        sendMagicLink.mockRejectedValue(new Error("offline"));
        const user = userEvent.setup();
        render(<Landing />);
        await openFindYourDot(user);
        await user.type(
          await screen.findByLabelText(/email address/i),
          "elsa@kth.se",
        );
        await user.click(
          screen.getByRole("button", { name: /send private link/i }),
        );

        expect(
          await screen.findByText(/could not send the link just now/i),
        ).toBeInTheDocument();
        const submit = screen.getByRole("button", {
          name: /send private link/i,
        });
        expect(submit).toBeEnabled();

        sendMagicLink.mockResolvedValue({ error: null });
        await user.click(submit);
        expect(
          await screen.findByText(/check your inbox/i),
        ).toBeInTheDocument();
      });

      it("says the send failed, not that the address is wrong", async () => {
        sendMagicLink.mockResolvedValue({ error: { message: "rate limited" } });
        const user = userEvent.setup();
        render(<Landing />);
        await openFindYourDot(user);
        await user.type(
          await screen.findByLabelText(/email address/i),
          "elsa@kth.se",
        );
        await user.click(
          screen.getByRole("button", { name: /send private link/i }),
        );

        expect(
          await screen.findByText(/could not send the link just now/i),
        ).toBeInTheDocument();
        expect(
          screen.queryByText(/enter a valid email address/i),
        ).not.toBeInTheDocument();
      });

      // Greptile reproduced this: a send left in flight when the panel closed
      // could land afterwards and report on an address the visitor abandoned.
      it("ignores a send the visitor walked away from", async () => {
        let settleFirst: (value: { error: null }) => void = () => {};
        sendMagicLink.mockImplementationOnce(
          () =>
            new Promise<{ error: null }>((resolve) => {
              settleFirst = resolve;
            }),
        );
        const user = userEvent.setup();
        render(<Landing />);

        await openFindYourDot(user);
        await user.type(
          await screen.findByLabelText(/email address/i),
          "first@kth.se",
        );
        await user.click(
          screen.getByRole("button", { name: /send private link/i }),
        );

        // Away, back, and a different address this time.
        await user.click(screen.getByRole("button", { name: "Close" }));
        await waitFor(() =>
          expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
        );
        sendMagicLink.mockResolvedValue({ error: null });
        await openFindYourDot(user);
        const field = await screen.findByLabelText(/email address/i);
        await user.clear(field);
        await user.type(field, "second@kth.se");
        await user.click(
          screen.getByRole("button", { name: /send private link/i }),
        );
        expect(await screen.findByText(/second@kth.se/)).toBeInTheDocument();

        // The abandoned request lands last and must change nothing.
        settleFirst({ error: null });
        await waitFor(() =>
          expect(screen.getByText(/second@kth.se/)).toBeInTheDocument(),
        );
        expect(screen.queryByText(/first@kth.se/)).not.toBeInTheDocument();
      });

      it("sends the private link back to the landing page", async () => {
        const user = userEvent.setup();
        render(<Landing />);
        await openFindYourDot(user);
        await user.type(
          await screen.findByLabelText(/email address/i),
          "elsa@kth.se",
        );
        await user.click(
          screen.getByRole("button", { name: /send private link/i }),
        );

        await waitFor(() =>
          expect(sendMagicLink).toHaveBeenCalledWith({
            email: "elsa@kth.se",
            callbackURL: "/?dot=1",
            errorCallbackURL: "/?dot=expired",
          }),
        );
        expect(
          await screen.findByText(/check your inbox/i),
        ).toBeInTheDocument();
      });
    });
  });

  describe("a member whose node exists", () => {
    beforeEach(() => {
      member();
      useNeighbourhood.mockReturnValue(
        graphState({ data: NEIGHBOURHOOD, isSuccess: true }),
      );
    });

    it("names the account and offers a way out of it", async () => {
      const user = userEvent.setup();
      render(<Landing />);
      expect(screen.getByText("Elsa Lindqvist")).toBeInTheDocument();
      await user.click(header().getByRole("button", { name: /log out/i }));
      expect(logout).toHaveBeenCalled();
    });

    // Their own neighbourhood *is* the hero, so it is read on load rather than
    // when the panel opens — and the public window is not asked for as well.
    it("reads their own neighbourhood on load, without being asked", () => {
      render(<Landing />);
      expect(useNeighbourhood).toHaveBeenCalledWith(true);
      expect(usePublicWindow).toHaveBeenCalledWith(false);
    });

    it("shows them their own dot once they ask", async () => {
      const user = userEvent.setup();
      render(<Landing />);

      await openFindYourDot(user);
      expect(await screen.findByText(/this one is yours/i)).toBeInTheDocument();
    });
  });

  describe("a member with no node yet", () => {
    beforeEach(() => {
      member();
      useNeighbourhood.mockReturnValue(
        graphState({ error: notFound(), isError: true }),
      );
    });

    it("says so plainly instead of drawing a dot that is not there", async () => {
      const user = userEvent.setup();
      render(<Landing />);
      await openFindYourDot(user);

      expect(
        await screen.findByText(/you don’t have a dot yet/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/nothing is missing on your side/i),
      ).toBeInTheDocument();
      expect(screen.queryByText(/this one is yours/i)).not.toBeInTheDocument();
    });

    it("blames nobody and reports no failure — this is a normal state", async () => {
      const user = userEvent.setup();
      render(<Landing />);
      await openFindYourDot(user);
      await screen.findByText(/you don’t have a dot yet/i);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /try again/i }),
      ).not.toBeInTheDocument();
    });

    it("closes without leaving anything behind", async () => {
      const user = userEvent.setup();
      render(<Landing />);
      await openFindYourDot(user);
      await user.click(await screen.findByRole("button", { name: "Done" }));
      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
      );
    });
  });

  describe("when the read fails for another reason", () => {
    it("offers the read again rather than claiming the dot is gone", async () => {
      const refetch = vi.fn();
      const user = userEvent.setup();
      member();
      useNeighbourhood.mockReturnValue(
        graphState({ error: new Error("boom"), isError: true, refetch }),
      );
      render(<Landing />);
      await openFindYourDot(user);

      expect(
        await screen.findByText(/the network did not answer/i),
      ).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /try again/i }));
      expect(refetch).toHaveBeenCalled();
    });

    // A member who cannot be located still sees the community they are part
    // of. What the failure costs them is the "You", not the graph.
    it("falls back to the public window so the hero still has a graph", () => {
      member();
      useNeighbourhood.mockReturnValue(
        graphState({ error: new Error("boom"), isError: true }),
      );
      render(<Landing />);
      expect(usePublicWindow).toHaveBeenCalledWith(true);
    });
  });

  describe("coming back through a private link", () => {
    it("opens straight into the reveal", async () => {
      search = "dot=1";
      member();
      useNeighbourhood.mockReturnValue(
        graphState({ data: NEIGHBOURHOOD, isSuccess: true }),
      );
      render(<Landing />);
      expect(await screen.findByText(/this one is yours/i)).toBeInTheDocument();
    });

    it("takes the outcome back out of the URL so a reload does not replay it", () => {
      search = "dot=1";
      member();
      render(<Landing />);
      expect(replace).toHaveBeenCalledWith("/");
    });

    // The graph is still read, because the hero draws it for everybody. What a
    // dead link costs is the reveal, not the community behind it.
    it("says a dead link is dead, and still draws the community", async () => {
      search = "dot=expired";
      member();
      render(<Landing />);
      expect(
        await screen.findByText(/this link no longer works/i),
      ).toBeInTheDocument();
      expect(useNeighbourhood).toHaveBeenCalledWith(true);
    });

    it("offers a fresh link, and asks a visitor for their address again", async () => {
      search = "dot=expired";
      visitor();
      const user = userEvent.setup();
      render(<Landing />);
      await user.click(
        await screen.findByRole("button", { name: /request a new link/i }),
      );
      expect(
        await screen.findByLabelText(/email address/i),
      ).toBeInTheDocument();
    });
  });

  it("asserts nothing about the session while it is still resolving", () => {
    useSessionData.mockReturnValue({ user: null, isPending: true });
    render(<Landing />);
    expect(
      header().queryByRole("button", { name: "Sign up" }),
    ).not.toBeInTheDocument();
    expect(
      header().queryByRole("button", { name: /log out/i }),
    ).not.toBeInTheDocument();
  });

  it("keeps the network decorative — it is never announced", () => {
    render(<Landing />);
    const canvas = screen.getByTestId("hero-network");
    expect(canvas).toHaveAttribute("aria-hidden", "true");
  });
});
