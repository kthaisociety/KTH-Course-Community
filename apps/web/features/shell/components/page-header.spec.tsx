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
});
