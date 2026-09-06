import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeedbackForm } from "./feedback-form";

const mutateAsync = vi.fn();
const isPending = vi.fn(() => false);

vi.mock("../api/mutations", () => ({
  useSubmitFeedback: () => ({
    mutateAsync,
    get isPending() {
      return isPending();
    },
  }),
}));

beforeEach(() => {
  mutateAsync.mockResolvedValue({ success: true });
  isPending.mockReturnValue(false);
});

async function fillIn(
  user: ReturnType<typeof userEvent.setup>,
  draft: { name?: string; email?: string; message?: string },
) {
  if (draft.name !== undefined) {
    await user.type(screen.getByLabelText("Name"), draft.name);
  }
  if (draft.email !== undefined) {
    await user.type(screen.getByLabelText("Email"), draft.email);
  }
  if (draft.message !== undefined) {
    await user.type(screen.getByLabelText("Message"), draft.message);
  }
}

function send(user: ReturnType<typeof userEvent.setup>) {
  return user.click(screen.getByRole("button", { name: "Send message" }));
}

describe("FeedbackForm", () => {
  // `feedback_form` has no user foreign key: the form is unauthenticated by
  // design. Nothing is mocked here because nothing here reads a session.
  describe("as a visitor with no session", () => {
    it("sends the message and confirms it in the designed state", async () => {
      const user = userEvent.setup({ delay: null });
      render(<FeedbackForm />);

      await fillIn(user, {
        name: "  Elsa Lindqvist  ",
        email: "  elsa@kth.se ",
        message: " The workload chart is upside down. ",
      });
      await send(user);

      expect(mutateAsync).toHaveBeenCalledWith({
        name: "Elsa Lindqvist",
        email: "elsa@kth.se",
        message: "The workload chart is upside down.",
      });

      const sent = await screen.findByRole("status");
      expect(sent).toHaveTextContent("Message sent");
      expect(sent).toHaveTextContent(
        "Thanks — we'll get back to you at elsa@kth.se.",
      );
      // The form gives way to the confirmation; it is not an alert over it.
      expect(
        screen.queryByRole("button", { name: "Send message" }),
      ).not.toBeInTheDocument();
    });

    /**
     * The panel was built when the palette had no green and borrowed
     * `--cc-info` with `--cc-brand` ink, which read as information rather than
     * success. The tint family exists now (#127 §1) and its three tokens are
     * the artboard's three hexes exactly, so the panel says "this worked" in
     * the design's own colours in both themes.
     *
     * Classes rather than computed colours: jsdom runs no Tailwind, so a
     * colour assertion here would only ever observe the absence of a
     * stylesheet. What regressed before was the token choice, and that is what
     * a class name records.
     */
    it("confirms in the success tint rather than a colour-mixed stand-in", async () => {
      const user = userEvent.setup({ delay: null });
      render(<FeedbackForm />);

      await fillIn(user, {
        name: "Elsa",
        email: "elsa@kth.se",
        message: "Hello",
      });
      await send(user);

      const sent = await screen.findByRole("status");
      expect(sent).toHaveClass(
        "bg-cc-success-tint",
        "border-cc-success-tint-border",
      );
      expect(within(sent).getByText("Message sent")).toHaveClass(
        "text-cc-success-ink",
      );
    });

    it("never offers or asks for an account", () => {
      render(<FeedbackForm />);
      expect(screen.queryByText(/sign up/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/log in/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/account/i)).not.toBeInTheDocument();
    });
  });

  describe("validation", () => {
    it("refuses an address that is not one, without calling the server", async () => {
      const user = userEvent.setup({ delay: null });
      render(<FeedbackForm />);

      await fillIn(user, {
        name: "Elsa",
        email: "elsa-at-kth",
        message: "Hello",
      });
      await send(user);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Enter a valid email.",
      );
      expect(mutateAsync).not.toHaveBeenCalled();
      // The form stays, filled in, so the mistake can be corrected.
      expect(screen.getByLabelText("Email")).toHaveValue("elsa-at-kth");
    });

    // The artboard's own regex would let this one through, and `feedback.submit`
    // would then refuse it — turning a fixable typo into a send failure.
    it("refuses what the server would refuse, not merely what looks like an address", async () => {
      const user = userEvent.setup({ delay: null });
      render(<FeedbackForm />);

      await fillIn(user, {
        name: "Elsa",
        email: "elsa@kth.s",
        message: "Hello",
      });
      await send(user);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Enter a valid email.",
      );
      expect(mutateAsync).not.toHaveBeenCalled();
    });

    it("names the fields it cannot do without", async () => {
      const user = userEvent.setup({ delay: null });
      render(<FeedbackForm />);

      await fillIn(user, { email: "elsa@kth.se", message: "   " });
      await send(user);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Name and message are required.",
      );
      expect(mutateAsync).not.toHaveBeenCalled();
    });
  });

  it("keeps the message when the server refuses it", async () => {
    mutateAsync.mockRejectedValue(new Error("500"));
    const user = userEvent.setup({ delay: null });
    render(<FeedbackForm />);

    await fillIn(user, {
      name: "Elsa",
      email: "elsa@kth.se",
      message: "Hello",
    });
    await send(user);

    const failure = await screen.findByRole("alert");
    expect(failure).toHaveTextContent("That did not send. Please try again.");
    // The artboard's `#a3452a` is `--cc-danger-ink`. The line used to borrow
    // `--cc-warn-ink` for want of a token, which turns out to be the review
    // draft's amber and says nothing about a failure (#127 §1, §4).
    expect(failure).toHaveClass("text-cc-danger-ink");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Message")).toHaveValue("Hello");
  });

  it("cannot be sent twice while the first send is in flight", () => {
    isPending.mockReturnValue(true);
    render(<FeedbackForm />);
    expect(screen.getByRole("button", { name: "Sending…" })).toBeDisabled();
  });
});
