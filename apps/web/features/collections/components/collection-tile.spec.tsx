import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Collection } from "@/features/courses";
import { CollectionTile } from "./collection-tile";

/**
 * The tile on its own, for the same reason as {@link CollectionChip}'s spec:
 * `collections.spec.tsx` owns the page behaviour, and this owns the one thing
 * that behaviour cannot show — which tokens the destructive item paints with.
 */

const COLLECTION: Collection = {
  id: "c1",
  name: "Machine learning",
  createdAt: "2026-01-01T00:00:00.000Z",
  courseCodes: ["DD2380"],
};

function renderTile() {
  const onDelete = vi.fn();
  render(
    <CollectionTile
      collection={COLLECTION}
      courseFor={() => undefined}
      onOpen={vi.fn()}
      onRename={vi.fn()}
      onDelete={onDelete}
    />,
  );
  return { onDelete };
}

describe("CollectionTile", () => {
  /**
   * Same pair as the chip's, from the same artboard rows — `--cc-danger-ink`
   * over a `--cc-danger-tint` hover. Both were `color-mix` derivations against
   * `--cc-danger` before the tint family existed, and both are
   * asserted separately because they are two components that happen to agree,
   * not one shared control.
   */
  it("paints Delete in the danger tint family, not a colour-mixed derivation", async () => {
    const user = userEvent.setup({ delay: null });
    renderTile();

    await user.click(
      screen.getByRole("button", { name: "More actions for Machine learning" }),
    );

    const remove = screen.getByRole("menuitem", { name: "Delete" });
    expect(remove).toHaveClass("text-cc-danger-ink", "hover:bg-cc-danger-tint");
    expect(remove.className).not.toContain("color-mix");
  });

  it("asks the page to delete rather than deleting anything itself", async () => {
    const user = userEvent.setup({ delay: null });
    const { onDelete } = renderTile();

    await user.click(
      screen.getByRole("button", { name: "More actions for Machine learning" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

    expect(onDelete).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menuitem", { name: "Delete" })).toBeNull();
  });
});
