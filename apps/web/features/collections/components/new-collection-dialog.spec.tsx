import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NewCollectionDialog } from "./new-collection-dialog";

/**
 * The width-related utilities the dialog actually renders with.
 *
 * jsdom computes no layout and there is no Tailwind stylesheet at test time, so
 * the class list is what a test can hold. It is the right surface anyway: the
 * string is `cn`'s output, and the failure this guards is a `cn` failure: a
 * `sm:max-w-*` on `DialogContent` sits in a different tailwind-merge group from
 * a plain `max-w-*` or a `w-*`, so the caller's width would not replace it.
 */
function widthClasses() {
  const content = document.querySelector('[data-slot="dialog-content"]');
  expect(content).not.toBeNull();
  return (content as HTMLElement).className
    .split(/\s+/)
    .filter((name) => /(^|:)(min-w|max-w|w)-/.test(name));
}

function open() {
  render(
    <NewCollectionDialog
      open
      savedCourses={[]}
      onClose={vi.fn()}
      onCreate={vi.fn()}
    />,
  );
}

describe("NewCollectionDialog", () => {
  it("opens on the artboard's title", () => {
    open();
    expect(
      screen.getByRole("heading", { name: "New collection" }),
    ).toBeInTheDocument();
  });

  it("renders at the 440px the artboard draws, not the primitive's 384px", () => {
    open();
    const classes = widthClasses();

    // `Collections.dc.html` draws this dialog at `width:440px`.
    expect(classes).toContain("w-[440px]");

    // Nothing narrows it above `sm`. The one cap is the artboard's own gutter,
    // which only bites below 472px.
    expect(classes.filter((name) => name.startsWith("sm:max-w-"))).toEqual([]);
    expect(classes.filter((name) => name.startsWith("max-w-"))).toEqual([
      "max-w-[calc(100vw-2rem)]",
    ]);
  });
});
