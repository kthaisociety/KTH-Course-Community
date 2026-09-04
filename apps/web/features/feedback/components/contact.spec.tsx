import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Contact } from "./contact";

vi.mock("../api/mutations", () => ({
  useSubmitFeedback: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

describe("Contact", () => {
  it("promotes the form's own two lines into the page header", () => {
    render(<Contact />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Get in touch" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Bug, idea, or just want to say hi — we read everything.",
      ),
    ).toBeInTheDocument();
    // ...and does not repeat them as a second heading above the fields.
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
  });

  it("takes a message from a visitor with no session", () => {
    render(<Contact />);
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Message")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Send message" }),
    ).toBeInTheDocument();
  });
});
