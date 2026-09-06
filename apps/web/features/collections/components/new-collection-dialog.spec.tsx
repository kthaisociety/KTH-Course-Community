import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NewCollectionDialog } from "./new-collection-dialog";

/**
 * The width-related utilities the dialog actually renders with.
 *
 * jsdom computes no layout and there is no Tailwind stylesheet at test time, so
 * the class list is what a test can hold. It is the right surface anyway: the
 * string is `cn`'s output, and #178 was a `cn` bug — `DialogContent` carried an
 * `sm:max-w-sm`, tailwind-merge keeps that in a different group from a plain
 * `max-w-*` or a `w-*`, and so the caller's width did not replace it.
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

    // `Collections.dc.html:183` draws this dialog at `width:440px`. It rendered
    // at 384px until #178, because the primitive's `sm:max-w-sm` outlived this
    // `w-[440px]` from the `sm` breakpoint up.
    expect(classes).toContain("w-[440px]");

    // Nothing narrows it above `sm` any more. The one cap left is the artboard's
    // own gutter, which only bites below 472px.
    expect(classes.filter((name) => name.startsWith("sm:max-w-"))).toEqual([]);
    expect(classes.filter((name) => name.startsWith("max-w-"))).toEqual([
      "max-w-[calc(100vw-2rem)]",
    ]);
  });
});
