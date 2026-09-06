import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProviders } from "./auth-providers";

const signInSocial = vi.fn();
const toastError = vi.fn();

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: {
      get social() {
        return signInSocial;
      },
    },
  },
}));
vi.mock("sonner", () => ({
  toast: {
    get error() {
      return toastError;
    },
  },
}));

beforeEach(() => {
  signInSocial.mockReset();
  signInSocial.mockResolvedValue({ data: null, error: null });
  toastError.mockReset();
  window.history.replaceState({}, "", "/auth");
});

// The provider icons carry a `<title>` of their own, so the accessible name
// of each button is "<Provider> logo <Provider>". Matched loosely, the way
// `auth-reason-dialog.spec.tsx` matches the same two buttons.
function providerButton(provider: "Google" | "GitHub") {
  return screen.getByRole("button", { name: new RegExp(provider, "i") });
}

function google() {
  return providerButton("Google");
}

describe("AuthProviders", () => {
  // The numbers the "Controls" row of
  // `docs/design_ref/2026-09-06/Course Community - Design System.dc.html` gives
  // for its Secondary button. shadcn's default is 32px at a 10px radius, which
  // is what these were and what nothing else on any other screen looks like.
  it("wears the design's secondary control, not shadcn's default", () => {
    render(<AuthProviders />);
    for (const provider of ["Google", "GitHub"] as const) {
      expect(providerButton(provider)).toHaveClass(
        "h-[38px]",
        "rounded-[9px]",
        "border-cc-rule3",
        "bg-cc-surface",
        "text-[13.5px]",
        "text-cc-ink",
      );
    }
  });

  // Not a media query: the pair fits or does not fit the *card*, which is
  // 400px wide on a 1440px display.
  it("stacks the pair on the card's width rather than the window's", () => {
    const { container } = render(<AuthProviders />);
    expect(container.firstElementChild).toHaveClass(
      "grid-cols-1",
      "@xs:grid-cols-2",
    );
  });

  // #180 fixed the two controls on `/auth` sending everyone to `/search`
  // whatever they were doing when they left. Styling this page must not undo
  // it, so the promise is asserted here rather than only in `return-to`'s own
  // unit tests.
  describe("where the sign-in comes back to", () => {
    it("returns to the page `?next=` names", async () => {
      window.history.replaceState(
        {},
        "",
        "/auth?next=%2Fcourse%2FDD2380%3Fq%3Dagents",
      );
      const user = userEvent.setup();
      render(<AuthProviders />);
      await user.click(google());

      await waitFor(() => expect(signInSocial).toHaveBeenCalledTimes(1));
      expect(signInSocial).toHaveBeenCalledWith({
        provider: "google",
        callbackURL: "/course/DD2380?q=agents",
      });
    });

    it("falls back to the front door when the URL does not say", async () => {
      const user = userEvent.setup();
      render(<AuthProviders />);
      await user.click(providerButton("GitHub"));

      await waitFor(() => expect(signInSocial).toHaveBeenCalledTimes(1));
      expect(signInSocial).toHaveBeenCalledWith({
        provider: "github",
        callbackURL: "/search",
      });
    });

    // `?next=` is read off the URL and handed to Better Auth, so anything that
    // is not a same-site path is an open redirect with a real sign-in in front
    // of it.
    it.each([
      "https://evil.example/steal",
      "//evil.example/steal",
      String.raw`/\evil.example/steal`,
    ])("refuses to come back to %s", async (destination) => {
      window.history.replaceState(
        {},
        "",
        `/auth?next=${encodeURIComponent(destination)}`,
      );
      const user = userEvent.setup();
      render(<AuthProviders />);
      await user.click(google());

      await waitFor(() => expect(signInSocial).toHaveBeenCalled());
      expect(signInSocial.mock.calls[0][0].callbackURL).toBe("/search");
    });
  });

  it("holds both buttons shut while one is in flight", async () => {
    let release: (value: { data: null; error: null }) => void = () => {};
    signInSocial.mockReturnValue(
      new Promise<{ data: null; error: null }>((resolve) => {
        release = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<AuthProviders />);
    await user.click(google());

    await waitFor(() => expect(google()).toBeDisabled());
    expect(providerButton("GitHub")).toBeDisabled();

    release({ data: null, error: null });
    await waitFor(() => expect(google()).toBeEnabled());
  });

  it("reports a refused sign-in instead of failing silently", async () => {
    signInSocial.mockResolvedValue({ data: null, error: { message: "nope" } });
    const user = userEvent.setup();
    render(<AuthProviders />);
    await user.click(google());
    await waitFor(() => expect(toastError).toHaveBeenCalled());
  });

  it("survives the client throwing", async () => {
    signInSocial.mockRejectedValue(new Error("network down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    render(<AuthProviders />);
    await user.click(google());
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(google()).toBeEnabled();
  });
});
