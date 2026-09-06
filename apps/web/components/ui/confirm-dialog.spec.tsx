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
   * `pointer-cursor.spec.tsx` sweeps `features/**` and this component now lives
   * outside it, so its two buttons are asserted here instead of falling into
   * the gap the move created.
   */
  it("gives both buttons the pointer cursor", () => {
    open();
    for (const name of [REQUEST.cancelLabel, REQUEST.actionLabel]) {
      expect(screen.getByRole("button", { name })).toHaveClass(
        "cursor-pointer",
      );
    }
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

    // `My Page.dc.html` draws the confirmation at `width:440px`, and stating it
    // once has to be enough: a second `sm:max-w-[440px]` would only be needed if
    // `DialogContent` carried a clamp a plain width could not merge away.
    expect(classes).toContain("w-[440px]");
    expect(classes.filter((name) => name.startsWith("sm:max-w-"))).toEqual([]);
    expect(classes.filter((name) => name.startsWith("max-w-"))).toEqual([
      "max-w-[calc(100vw-2rem)]",
    ]);
  });
});
