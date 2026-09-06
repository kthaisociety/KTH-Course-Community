import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Auth } from "./auth";

// The page composes two client components that reach for the auth client at
// import time. Neither is what this suite is about, so both get a client that
// does nothing rather than a network.
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: { social: vi.fn(), magicLink: vi.fn() },
  },
}));

function ground() {
  return screen.getByRole("main");
}

function card() {
  const surface = ground().firstElementChild;
  if (!surface) throw new Error("the page rendered no card");
  return surface;
}

describe("Auth", () => {
  // The regression this route exists to hold. `/auth` was shadcn's `login-02`
  // block and the only file under `features/` with no `--cc-*` class at all,
  // which is how it ended up painting `bg-muted` — an alias of `--cc-pill`, and
  // in dark theme a 16% cream over the page that composites to a `#2d3a4d`
  // grey. The card under it is `#0b254c`. A ground lighter than the thing
  // standing on it is the surface hierarchy upside down, and it was the first
  // screen a signed-out visitor saw.
  describe("surfaces", () => {
    it("rests the card on the page ground, not the other way round", () => {
      render(<Auth />);
      expect(ground()).toHaveClass("bg-cc-pg");
      expect(ground()).not.toHaveClass("bg-muted");
      expect(card()).toHaveClass("bg-cc-surface", "border-cc-rule2");
    });

    it("opts the page into the theme cross-fade", () => {
      render(<Auth />);
      expect(ground()).toHaveClass("cc-theme");
    });

    // The provider pair reflows on the card's width, not the viewport's: the
    // card is 400px wide long before the window is narrow.
    it("makes the card the container the controls measure", () => {
      render(<Auth />);
      expect(card()).toHaveClass("@container", "max-w-[400px]");
    });

    // A flex item centred by justification overflows *both* ends of a container
    // it outgrows, and the top end is the one nothing can scroll back to. This
    // card grows: the expired-link banner adds most of a hundred pixels to it,
    // which is enough on a landscape phone.
    it("centres the card without putting its top out of reach", () => {
      render(<Auth error="INVALID_TOKEN" />);
      expect(card()).toHaveClass("m-auto");
      expect(ground()).not.toHaveClass("justify-center");
    });
  });

  describe("copy", () => {
    // `REASONS["log-in"]` from `Course Community - Landing.dc.html` — the same
    // three lines `AuthReasonDialog` renders. What was here was shadcn's
    // "Welcome!".
    it("greets a visitor in the design's own words", () => {
      render(<Auth />);
      expect(screen.getByText("Welcome back")).toBeInTheDocument();
      expect(
        screen.getByRole("heading", {
          level: 1,
          name: "Log in to Course Community",
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/browsing never needs an account/i),
      ).toBeVisible();
      expect(screen.queryByText("Welcome!")).not.toBeInTheDocument();
    });

    // `server/auth.ts` configures no KTH IdP, so the artboard's own
    // "Continue with KTH account" must not ship however well it reads.
    it("names only providers the server actually has", () => {
      render(<Auth />);
      expect(screen.getByRole("button", { name: /google/i })).toBeVisible();
      expect(screen.getByRole("button", { name: /github/i })).toBeVisible();
      expect(
        screen.queryByRole("button", { name: /kth account/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("a link that did not work", () => {
    it("says why and what to do, in the artboard's words", () => {
      render(<Auth error="INVALID_TOKEN" />);
      const banner = screen.getByRole("alert");
      expect(banner).toHaveTextContent("This link no longer works");
      expect(banner).toHaveTextContent(
        /private links expire after a short while/i,
      );
      // The Design System's `BANNERS` pairs these three for "Error banner".
      expect(banner).toHaveClass(
        "bg-cc-danger-tint",
        "border-cc-danger-tint-border",
      );
    });

    // Better Auth sends the visitor back here rather than nowhere, and the two
    // working ways in have to stay reachable underneath the bad news.
    it("keeps both ways in offered underneath it", () => {
      render(<Auth error="INVALID_TOKEN" />);
      expect(screen.getByRole("button", { name: /google/i })).toBeVisible();
      expect(screen.getByLabelText("Email")).toBeVisible();
    });

    it("says nothing when the visitor simply arrived", () => {
      render(<Auth />);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  // The stock divider was a centred `after:border-t` with a label repainting
  // the card's background over the middle of it, which only works while the
  // label is one line on the exact surface it assumes.
  it("draws the divider as two hairlines around its label", () => {
    const { container } = render(<Auth />);
    const label = screen.getByText("Or continue with email");
    const rules = label.parentElement?.querySelectorAll("span.bg-cc-rule");
    expect(rules).toHaveLength(2);
    expect(container.querySelector("[class*='after:border-t']")).toBeNull();
  });
});
