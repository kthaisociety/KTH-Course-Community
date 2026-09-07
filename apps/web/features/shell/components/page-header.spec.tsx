import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageHeader } from "./page-header";

describe("PageHeader", () => {
  it("titles the page at heading level one", () => {
    render(<PageHeader title="Saved courses" />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Saved courses" }),
    ).toBeInTheDocument();
  });

  it("carries the supporting line when there is one", () => {
    render(
      <PageHeader
        title="Saved courses"
        subtitle="Keep track of courses you are interested in."
      />,
    );
    expect(
      screen.getByText("Keep track of courses you are interested in."),
    ).toBeInTheDocument();
  });

  // The artboard shows no empty line under a bare title, so the element itself
  // must go rather than render blank and take up its margin.
  it("renders nothing under a bare title", () => {
    const { container } = render(<PageHeader title="Explore" />);
    expect(container.querySelector("h1")?.nextElementSibling).toBeNull();
  });

  it("draws a leading slot before the title", () => {
    render(
      <PageHeader
        title="Elsa Lindqvist"
        subtitle="Private to you."
        leading={<span data-testid="avatar" />}
      />,
    );
    const avatar = screen.getByTestId("avatar");
    const heading = screen.getByRole("heading", { level: 1 });
    expect(
      avatar.compareDocumentPosition(heading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  // The five routes that pass no slot must keep the header they had, so the
  // row collapses to the title block alone rather than leaving an empty cell.
  it("adds nothing to the row when there is no leading slot", () => {
    const { container } = render(<PageHeader title="Explore" />);
    const row = container.querySelector("h1")?.parentElement?.parentElement;
    expect(row?.children).toHaveLength(1);
  });

  it("uses the named shell breakpoint so tablet containers cannot lose the title", () => {
    const { container } = render(<PageHeader title="Explore courses" />);
    expect(container.firstElementChild).toHaveClass("hidden");
    expect(container.firstElementChild).toHaveClass("@3xl/shell:block");
  });
});
