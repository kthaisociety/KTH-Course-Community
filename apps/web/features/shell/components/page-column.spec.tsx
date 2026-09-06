import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageColumn } from "./page-column";

describe("PageColumn", () => {
  it("caps the page at the design's shared width", () => {
    render(
      <PageColumn>
        <p>Page body</p>
      </PageColumn>,
    );
    const column = screen.getByText("Page body").parentElement;
    // `PAGE_MAX_WIDTH` in docs/design_ref/2026-09-06/cc-store.js.
    expect(column).toHaveClass("max-w-[1216px]");
  });

  // The artboards respond to their rendered box, not the viewport, so the
  // column has to be its own container for the query below to mean anything.
  it("answers to its own width rather than the window's", () => {
    const { container } = render(
      <PageColumn>
        <p>Page body</p>
      </PageColumn>,
    );
    expect(container.firstElementChild).toHaveClass("@container");
    expect(screen.getByText("Page body").parentElement).toHaveClass(
      "@2xl:px-5",
    );
  });
});
