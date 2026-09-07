import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SignInPrompt } from "./sign-in-prompt";

describe("SignInPrompt", () => {
  describe("the link form, for a page that is entirely signed out", () => {
    it("offers both ways in, and sends both to the same place", () => {
      render(
        <SignInPrompt
          title="Sign in to see your page"
          action={{ kind: "link", href: "/auth?next=%2Fprofile" }}
        />,
      );

      // Two controls rather than one: the pair is what tells a first-time
      // reader they are welcome. `/auth` signs up and logs in from one field,
      // so they lead to the same href — that is the surface, not a slip.
      for (const name of ["Sign up", "Log in"]) {
        expect(screen.getByRole("link", { name })).toHaveAttribute(
          "href",
          "/auth?next=%2Fprofile",
        );
      }
    });
  });

  describe("the ask form, for a prompt over a page the reader is working in", () => {
    it("raises the sign-in dialog instead of navigating", async () => {
      const onSignUp = vi.fn();
      const onLogIn = vi.fn();
      render(
        <SignInPrompt
          title="Organize your saved courses into collections"
          action={{ kind: "ask", onSignUp, onLogIn }}
        />,
      );

      expect(screen.queryByRole("link")).toBeNull();

      await userEvent.click(screen.getByRole("button", { name: "Sign up" }));
      expect(onSignUp).toHaveBeenCalledTimes(1);
      expect(onLogIn).not.toHaveBeenCalled();

      await userEvent.click(screen.getByRole("button", { name: "Log in" }));
      expect(onLogIn).toHaveBeenCalledTimes(1);
    });
  });

  /**
   * The height is a contract, not a style. Saved draws this card inside a band
   * that is exactly `--cc-search-block-h` tall, and that band is what puts
   * Saved's workspace tab strip on the same line as Explore's. A taller card
   * here moves a tab strip two pages away.
   */
  it("is the slim card the band can hold", () => {
    render(
      <SignInPrompt title="Sign in" action={{ kind: "link", href: "/auth" }} />,
    );

    const card = screen.getByTestId("sign-in-prompt");
    expect(card).toHaveClass("h-[42px]");
    // The card chrome My Page had and the band did not — this is the half of
    // the reconciliation that came *back*.
    expect(card).toHaveClass("border", "border-cc-rule2", "bg-cc-surface");
    // And the half that did not: it takes the width it is given.
    expect(card).not.toHaveClass("max-w-[520px]");
  });

  it("carries no promise it has no room for", () => {
    render(
      <SignInPrompt title="Sign in" action={{ kind: "link", href: "/auth" }} />,
    );

    expect(screen.queryByText(/sync across devices/)).toBeNull();
  });

  it("keeps the host's spacing outside its own border", () => {
    render(
      <SignInPrompt
        title="Sign in"
        action={{ kind: "link", href: "/auth" }}
        className="min-w-0 flex-1"
      />,
    );

    expect(screen.getByTestId("sign-in-prompt")).toHaveClass(
      "min-w-0",
      "flex-1",
    );
  });
});
