import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog, type ConfirmRequest } from "./confirm-dialog";

const REQUEST: ConfirmRequest = {
  eyebrow: "Collections",
  title: "Delete this collection?",
  body: "The courses stay saved. The collection and its order do not.",
  cancelLabel: "Keep collection",
  actionLabel: "Delete collection",
};

function open(request: ConfirmRequest | null = REQUEST) {
  render(
    <ConfirmDialog request={request} onCancel={vi.fn()} onConfirm={vi.fn()} />,
  );
}

/** See `new-collection-dialog.spec.tsx` for why the class list is the surface. */
function widthClasses() {
  const content = document.querySelector('[data-slot="dialog-content"]');
  expect(content).not.toBeNull();
  return (content as HTMLElement).className
    .split(/\s+/)
    .filter((name) => /(^|:)(min-w|max-w|w)-/.test(name));
}

describe("ConfirmDialog", () => {
  it("is shut when there is nothing to confirm", () => {
    open(null);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  /**
   * The four delete confirmations this replaced were built on `AlertDialog` and
   * so announced as `alertdialog`; this is built on `Dialog`, which announces
   * `dialog`, and the difference is whether a screen reader treats the question
   * as interrupting. The role is restored by passing it through, which only
   * works because Radix spreads a caller's props over its own `role="dialog"` —
   * an implementation detail of the primitive, and therefore worth a test rather
   * than a comment.
   */
  it("announces as an alertdialog, not a plain dialog", () => {
    open();
    const content = screen.getByRole("alertdialog");
    expect(content).toHaveAccessibleName(REQUEST.title);
    expect(content).toHaveAccessibleDescription(REQUEST.body);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  /**
   * Cancel is first in the DOM so it is what Radix focuses on open: the safe
   * half of a destructive question should be the one a stray Enter hits. Every
   * caller relies on it and none states it, so it is asserted once here.
   */
  it("opens with the safe choice focused", () => {
    open();
    expect(
      screen.getByRole("button", { name: REQUEST.cancelLabel }),
    ).toHaveFocus();
  });

  it("keeps its 440px without the workaround it used to need", () => {
    open();
    const classes = widthClasses();

    // `My Page.dc.html:428` draws the confirmation at `width:440px`. This
    // component used to state that twice — `w-[440px]` plus an
    // `sm:max-w-[440px]` — because `DialogContent` carried an `sm:max-w-sm` that
    // a plain width could not merge away. #178 removed the clamp, so the second
    // statement went with it; this asserts the first one is now enough.
    expect(classes).toContain("w-[440px]");
    expect(classes.filter((name) => name.startsWith("sm:max-w-"))).toEqual([]);
    expect(classes.filter((name) => name.startsWith("max-w-"))).toEqual([
      "max-w-[calc(100vw-2rem)]",
    ]);
  });
});
