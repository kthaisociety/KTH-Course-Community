import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { About } from "./about";

// The form has its own suite; here it only has to be present, and stubbing it
// keeps this page test off the tRPC client.
vi.mock("@/features/feedback", () => ({
  FeedbackForm: () => <div data-testid="feedback-form" />,
}));

describe("About", () => {
  it("titles the page the way the artboard and the rail both do", () => {
    render(<About />);
    expect(
      screen.getByRole("heading", { level: 1, name: "About & contact" }),
    ).toBeInTheDocument();
  });

  it("points at the real repository rather than the artboard's placeholder", () => {
    render(<About />);
    const link = screen.getByRole("link", { name: /view the repository/i });
    expect(link).toHaveAttribute(
      "href",
      "https://github.com/kthaisociety/KTH-Course-Community",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
  });

  // The artboard imports the Contact Form section into this page, so About
  // carries the form itself rather than sending the reader to another route.
  it("carries the feedback form under its own heading", () => {
    render(<About />);
    expect(
      screen.getByRole("heading", { level: 2, name: "Get in touch" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("feedback-form")).toBeInTheDocument();
  });
});
