import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { UserAvatar } from "./user-avatar";

/**
 * Radix decides which of the two halves to mount by loading the URL itself, in
 * a detached `window.Image`, and reading `complete`/`naturalWidth` back off it.
 * jsdom fetches nothing, so that image never completes and every test here
 * would see the fallback whatever the URL said — the picture would go untested
 * and a regression that dropped it entirely would stay green.
 *
 * So the loader is stubbed rather than the component: `succeeds()` reports a
 * picture that arrived, `fails()` one that did not. Radix reads the flags
 * synchronously after assigning `src`, which is why setting them in the setter
 * is enough and no test here has to wait.
 */
function stubImageLoader(naturalWidth: number) {
  class StubImage extends EventTarget {
    complete = false;
    naturalWidth = 0;
    crossOrigin: string | null = null;
    referrerPolicy = "";
    #src = "";

    get src() {
      return this.#src;
    }

    set src(value: string) {
      this.#src = value;
      this.complete = true;
      this.naturalWidth = naturalWidth;
    }
  }

  window.Image = StubImage as unknown as typeof window.Image;
}

/** The provider's URL resolves to a real picture. */
function succeeds() {
  stubImageLoader(1);
}

/** It 404s, or the browser blocks it — an expired Google URL, say. */
function fails() {
  stubImageLoader(0);
}

const realImage = window.Image;

beforeEach(succeeds);
afterEach(() => {
  window.Image = realImage;
});

function picture() {
  return document.querySelector("[data-slot=avatar-image]");
}

const elsa = {
  name: "Elsa Lindqvist",
  email: "elsa@kth.se",
  image: "https://lh3.googleusercontent.com/a/elsa",
};

describe("UserAvatar", () => {
  it("renders the picture the provider gave Better Auth", () => {
    render(<UserAvatar user={elsa} />);
    expect(picture()).toHaveAttribute("src", elsa.image);
    expect(screen.queryByText("EL")).not.toBeInTheDocument();
  });

  // A magic-link account has none, and never gets one: nothing in this app
  // writes `users.image`.
  it("shows initials when the account has no picture", () => {
    render(<UserAvatar user={{ ...elsa, image: null }} />);
    expect(screen.getByText("EL")).toBeInTheDocument();
    expect(picture()).toBeNull();
  });

  // The whole reason the picture goes through Radix rather than a bare `img`.
  it("degrades to initials rather than a broken picture", () => {
    fails();
    render(<UserAvatar user={elsa} />);
    expect(screen.getByText("EL")).toBeInTheDocument();
    expect(picture()).toBeNull();
  });

  it("falls back to the email when there is no name", () => {
    render(
      <UserAvatar user={{ name: "", email: "nils@kth.se", image: null }} />,
    );
    expect(screen.getByText("N")).toBeInTheDocument();
  });

  it("draws a mark rather than nothing while the session resolves", () => {
    render(<UserAvatar user={null} />);
    expect(screen.getByText("?")).toBeInTheDocument();
  });

  // The name sits immediately beside the circle at all three call sites, so the
  // picture must not announce the same account a second time.
  it("leaves the picture out of the accessibility tree", () => {
    render(<UserAvatar user={elsa} />);
    expect(picture()).toHaveAttribute("alt", "");
  });

  it("lets the surface paint its own circle", () => {
    render(
      <UserAvatar
        user={{ ...elsa, image: null }}
        className="size-[34px]"
        fallbackClassName="bg-white/25"
      />,
    );
    expect(document.querySelector("[data-slot=avatar]")).toHaveClass(
      "size-[34px]",
    );
    expect(screen.getByText("EL")).toHaveClass("bg-white/25");
  });
});
