import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MagicLinkForm } from "./magic-link-form";

const signInMagicLink = vi.fn();
const toastError = vi.fn();

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: {
      get magicLink() {
        return signInMagicLink;
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
  signInMagicLink.mockReset();
  signInMagicLink.mockResolvedValue({ data: null, error: null });
  toastError.mockReset();
  window.history.replaceState({}, "", "/auth");
});

function field() {
  return screen.getByLabelText("Email");
}

function submit() {
  return screen.getByRole("button", { name: "Email me a sign-in link" });
}

async function send(address: string) {
  const user = userEvent.setup();
  if (address) await user.type(field(), address);
  await user.click(submit());
  return user;
}

describe("MagicLinkForm", () => {
  // The "Controls" row of
  // `docs/design_ref/2026-09-05/Course Community - Design System.dc.html`: a
  // field is 40px at a 10px radius, a primary button 38px at 9px. Both were
  // shadcn's 32px at 10px.
  describe("control metrics", () => {
    it("gives the address the design's field", () => {
      render(<MagicLinkForm />);
      expect(field()).toHaveClass(
        "h-10",
        "rounded-[10px]",
        "border-cc-rule3",
        "bg-cc-surface",
        "text-[14px]",
      );
    });

    it("gives the send the design's primary action", () => {
      render(<MagicLinkForm />);
      expect(submit()).toHaveClass(
        "h-[38px]",
        "rounded-[9px]",
        "bg-cc-btn",
        "text-cc-btn-fg",
        "text-[13.5px]",
      );
    });
  });

  describe("an address that is not one", () => {
    // `type="email"` alone hands this to the browser, which refuses the submit
    // and raises its own bubble — native chrome the design has no say over, and
    // which left `formSchema`'s message unreachable. The form opts out so the
    // designed line is what a visitor actually sees.
    it("shows the schema's own message rather than the browser's bubble", async () => {
      render(<MagicLinkForm />);
      await send("not-an-email");

      const message = await screen.findByRole("alert");
      expect(message).toHaveTextContent("Enter a valid email address.");
      expect(message).toHaveClass("text-cc-danger");
      // The border says the same thing the message does, in the same colour —
      // which is what `find-your-dot.tsx` does with the same artboard.
      expect(field()).toHaveClass("aria-invalid:border-cc-danger");
    });

    it("points the field at the message so a screen reader reaches it", async () => {
      render(<MagicLinkForm />);
      await send("not-an-email");

      const message = await screen.findByRole("alert");
      await waitFor(() =>
        expect(field()).toHaveAttribute("aria-invalid", "true"),
      );
      expect(field()).toHaveAttribute("aria-describedby", message.id);
    });

    it("sends nothing", async () => {
      render(<MagicLinkForm />);
      await send("not-an-email");
      await screen.findByRole("alert");
      expect(signInMagicLink).not.toHaveBeenCalled();
    });

    it("says nothing before the visitor has tried", () => {
      render(<MagicLinkForm />);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(field()).toHaveAttribute("aria-invalid", "false");
    });
  });

  // #180 fixed the magic link hardcoding `callbackURL: "/search"` and throwing
  // the return location away. This is the path that cannot recover it any other
  // way — the link is opened in a new tab, where the URL the mail carries is
  // the only thing that survives — so the promise is asserted here rather than
  // left to `return-to`'s unit tests alone.
  describe("where the link comes back to", () => {
    it("mails a link back to the page `?next=` names", async () => {
      window.history.replaceState(
        {},
        "",
        "/auth?next=%2Fcourse%2FDD2380%3Fq%3Dagents",
      );
      render(<MagicLinkForm />);
      await send("elsa@kth.se");

      await waitFor(() => expect(signInMagicLink).toHaveBeenCalledTimes(1));
      expect(signInMagicLink).toHaveBeenCalledWith({
        email: "elsa@kth.se",
        callbackURL: "/course/DD2380?q=agents",
        errorCallbackURL: "/auth",
      });
    });

    it("falls back to the front door when the URL does not say", async () => {
      render(<MagicLinkForm />);
      await send("elsa@kth.se");

      await waitFor(() => expect(signInMagicLink).toHaveBeenCalledTimes(1));
      expect(signInMagicLink.mock.calls[0][0].callbackURL).toBe("/search");
    });

    it("refuses to come back to somewhere that is not this site", async () => {
      window.history.replaceState(
        {},
        "",
        "/auth?next=https%3A%2F%2Fevil.example%2Fsteal",
      );
      render(<MagicLinkForm />);
      await send("elsa@kth.se");

      await waitFor(() => expect(signInMagicLink).toHaveBeenCalled());
      expect(signInMagicLink.mock.calls[0][0].callbackURL).toBe("/search");
    });
  });

  describe("once the link is on its way", () => {
    it("confirms it in the artboard's words, with the address it used", async () => {
      render(<MagicLinkForm />);
      await send("elsa@kth.se");

      const sent = await screen.findByRole("status");
      expect(sent).toHaveTextContent("Check your inbox");
      expect(sent).toHaveTextContent(/sign-in link to elsa@kth\.se/);
      // `BANNERS` in the Design System artboard pairs these for a banner that
      // says something worked.
      expect(sent).toHaveClass(
        "bg-cc-success-tint",
        "border-cc-success-tint-border",
      );
    });

    it("takes the form away so nothing is sent twice", async () => {
      render(<MagicLinkForm />);
      await send("elsa@kth.se");

      await screen.findByRole("status");
      expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Email me a sign-in link" }),
      ).not.toBeInTheDocument();
    });
  });

  it("reports a refused send and leaves the form standing", async () => {
    signInMagicLink.mockResolvedValue({
      data: null,
      error: { message: "nope" },
    });
    render(<MagicLinkForm />);
    await send("elsa@kth.se");

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(field()).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
