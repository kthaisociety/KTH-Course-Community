import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TRPCClientError } from "@trpc/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Landing } from "./landing";

const push = vi.fn();
const replace = vi.fn();
const logout = vi.fn();
const setTheme = vi.fn();
const useSessionData = vi.fn();
const useNeighbourhood = vi.fn();
const sendMagicLink = vi.fn();

let search = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(search),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light", setTheme }),
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
}));

/** The community graph has nobody in it, which is what a member gets today. */
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

const NEIGHBOURHOOD = {
  viewer: { userId: "u1", x: 0, y: 0, effectiveTier: 1 },
  nodes: [
    {
      userId: "u1",
      x: 0,
      y: 0,
      color: "violet",
      style: "default",
      signalStyle: "default",
    },
    {
      userId: "u2",
      x: 240,
      y: -120,
      color: "moss",
      style: "default",
      signalStyle: "default",
    },
  ],
  edges: [{ nodeUserId: "u1", anchorUserId: "u2" }],
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
  sendMagicLink.mockResolvedValue({ error: null });
  // jsdom has no 2d context. The hero is decoration, so the page must render
  // without one rather than throw.
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as never;
});

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

    it("never asks the community graph anything — it is a protected read", () => {
      render(<Landing />);
      expect(useNeighbourhood).toHaveBeenCalledWith(false);
    });

    it("hands a typed search over to Explore", async () => {
      const user = userEvent.setup();
      render(<Landing />);
      await user.type(
        screen.getByLabelText(/search a course, code or subject/i),
        "graph theory{Enter}",
      );
      expect(push).toHaveBeenCalledWith("/search?q=graph%20theory");
    });

    it("hands a suggestion over the same way", async () => {
      const user = userEvent.setup();
      render(<Landing />);
      await user.click(screen.getByRole("button", { name: "DD2380" }));
      expect(push).toHaveBeenCalledWith("/search?q=DD2380");
    });

    it("goes nowhere on an empty search", async () => {
      const user = userEvent.setup();
      render(<Landing />);
      await user.type(
        screen.getByLabelText(/search a course, code or subject/i),
        "   {Enter}",
      );
      expect(push).not.toHaveBeenCalled();
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

    it("shows them their own dot once they ask", async () => {
      const user = userEvent.setup();
      render(<Landing />);
      expect(useNeighbourhood).toHaveBeenCalledWith(false);

      await openFindYourDot(user);
      expect(await screen.findByText(/this one is yours/i)).toBeInTheDocument();
      expect(useNeighbourhood).toHaveBeenLastCalledWith(true);
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

    it("says a dead link is dead, and does not read the graph on its behalf", async () => {
      search = "dot=expired";
      member();
      render(<Landing />);
      expect(
        await screen.findByText(/this link no longer works/i),
      ).toBeInTheDocument();
      expect(useNeighbourhood).toHaveBeenCalledWith(false);
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
