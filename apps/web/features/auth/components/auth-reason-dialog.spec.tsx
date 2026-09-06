import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type AuthReason, AuthReasonDialog } from "./auth-reason-dialog";

const signInSocial = vi.fn();
const push = vi.fn();
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
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
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
  push.mockReset();
  toastError.mockReset();
  window.history.replaceState({}, "", "/course/DD2380?q=agents");
});

function open(
  reason: AuthReason,
  props: Partial<React.ComponentProps<typeof AuthReasonDialog>> = {},
) {
  return render(
    <AuthReasonDialog
      reason={reason}
      onReasonChange={props.onReasonChange ?? vi.fn()}
      onClose={props.onClose ?? vi.fn()}
    />,
  );
}

describe("AuthReasonDialog", () => {
  it("stays shut when there is no reason", () => {
    render(
      <AuthReasonDialog
        reason={null}
        onReasonChange={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each([
    ["log-in", /welcome back/i, /log in to course community/i],
    ["sign-up", /^join$/i, /create your account/i],
    ["save-course", /one step left/i, /sign in to save this course/i],
    ["post-review", /one step left/i, /sign in to publish your review/i],
  ] as const)("names why it is asking for %s", (reason, kicker, title) => {
    open(reason);
    expect(screen.getByText(kicker)).toBeInTheDocument();
    expect(screen.getByText(title)).toBeInTheDocument();
  });

  it("promises the work in progress survives a protected action", () => {
    open("post-review");
    expect(screen.getByText(/draft is held as it is/i)).toBeInTheDocument();
    expect(
      screen.getByText(/nothing is published until you confirm/i),
    ).toBeInTheDocument();
  });

  it("offers only providers the server actually has configured", () => {
    open("log-in");
    expect(
      screen.getByRole("button", { name: /continue with google/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /continue with github/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /continue with email/i }),
    ).toBeInTheDocument();
    // There is no KTH IdP in server/auth.ts, so the artboard's button must not ship.
    expect(
      screen.queryByRole("button", { name: /kth account/i }),
    ).not.toBeInTheDocument();
  });

  it.each(["google", "github"] as const)(
    "signs in with %s",
    async (provider) => {
      const user = userEvent.setup();
      open("log-in");
      await user.click(
        screen.getByRole("button", { name: new RegExp(provider, "i") }),
      );

      await waitFor(() => expect(signInSocial).toHaveBeenCalledTimes(1));
      expect(signInSocial).toHaveBeenCalledWith(
        expect.objectContaining({ provider }),
      );
    },
  );

  // "You keep everything you were looking at" is a promise the callbackURL keeps.
  it("returns the visitor to the page they were on, query intact", async () => {
    const user = userEvent.setup();
    open("save-course");
    await user.click(screen.getByRole("button", { name: /google/i }));

    await waitFor(() => expect(signInSocial).toHaveBeenCalled());
    expect(signInSocial.mock.calls[0][0].callbackURL).toBe(
      "/course/DD2380?q=agents",
    );
  });

  // The email path leaves this tab for `/auth`, and the link `/auth` mails is
  // opened in a *new* one — so the destination has to travel in the URL or it
  // does not travel at all.
  it("routes to the full auth page for email, carrying where to come back to", async () => {
    const user = userEvent.setup();
    open("log-in");
    await user.click(
      screen.getByRole("button", { name: /continue with email/i }),
    );
    expect(push).toHaveBeenCalledWith(
      "/auth?next=%2Fcourse%2FDD2380%3Fq%3Dagents",
    );
    expect(signInSocial).not.toHaveBeenCalled();
  });

  // `?next=` is read straight back out and handed to Better Auth, so a
  // destination that is not this site is an open redirect with a real sign-in
  // in front of it. Rejected here, before it can be offered to anyone.
  it.each([
    "https://evil.example/steal",
    "//evil.example/steal",
    String.raw`/\evil.example/steal`,
  ])("refuses to come back to %s", async (destination) => {
    window.history.replaceState({}, "", "/search");
    const user = userEvent.setup();
    render(
      <AuthReasonDialog
        reason="log-in"
        onReasonChange={vi.fn()}
        onClose={vi.fn()}
        returnTo={() => destination}
      />,
    );
    await user.click(screen.getByRole("button", { name: /google/i }));

    await waitFor(() => expect(signInSocial).toHaveBeenCalled());
    expect(signInSocial.mock.calls[0][0].callbackURL).toBe("/search");
  });

  // A caller may know something the URL has stopped saying — the review draft
  // panel puts back the `?open=` a host has already spent — so the destination
  // is a mapper over where the visitor is, not a fixed string.
  it("lets the caller adjust where the sign-in comes back to", async () => {
    const user = userEvent.setup();
    render(
      <AuthReasonDialog
        reason="post-review"
        onReasonChange={vi.fn()}
        onClose={vi.fn()}
        returnTo={(here) => `${here}&open=DD2380&kind=review`}
      />,
    );
    await user.click(screen.getByRole("button", { name: /google/i }));

    await waitFor(() => expect(signInSocial).toHaveBeenCalled());
    expect(signInSocial.mock.calls[0][0].callbackURL).toBe(
      "/course/DD2380?q=agents&open=DD2380&kind=review",
    );
  });

  it("reports a failed sign-in instead of failing silently", async () => {
    signInSocial.mockResolvedValue({ data: null, error: { message: "nope" } });
    const user = userEvent.setup();
    open("log-in");
    await user.click(screen.getByRole("button", { name: /google/i }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
  });

  it("survives the client throwing", async () => {
    signInSocial.mockRejectedValue(new Error("network down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    open("log-in");
    await user.click(screen.getByRole("button", { name: /github/i }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
  });

  it("toggles between logging in and signing up", async () => {
    const onReasonChange = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <AuthReasonDialog
        reason="log-in"
        onReasonChange={onReasonChange}
        onClose={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /new here\? sign up instead/i }),
    );
    expect(onReasonChange).toHaveBeenCalledWith("sign-up");

    rerender(
      <AuthReasonDialog
        reason="sign-up"
        onReasonChange={onReasonChange}
        onClose={vi.fn()}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: /already have an account/i }),
    );
    expect(onReasonChange).toHaveBeenLastCalledWith("log-in");
  });

  it("always leaves a way to keep browsing as a guest", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    open("log-in", { onClose });
    await user.click(
      screen.getByRole("button", { name: /keep browsing as a guest/i }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("phrases the way out in terms of what the visitor was doing", () => {
    open("post-review");
    expect(
      screen.getByRole("button", { name: /back to my draft/i }),
    ).toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    open("log-in", { onClose });
    await user.keyboard("{Escape}");
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
