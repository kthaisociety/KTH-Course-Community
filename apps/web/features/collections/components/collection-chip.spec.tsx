import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Collection } from "@/features/courses";
import { CollectionChip } from "./collection-chip";

/**
 * The chip on its own. `collections.spec.tsx` covers it inside the page, which
 * is where its behaviour belongs; what is here is the part of it the page test
 * cannot see — which tokens its destructive item paints with.
 */

const COLLECTION: Collection = {
  id: "c1",
  name: "Machine learning",
  createdAt: "2026-01-01T00:00:00.000Z",
  courseCodes: ["DD2380", "DD2421"],
};

function renderChip() {
  const onDelete = vi.fn();
  render(
    <CollectionChip
      collection={COLLECTION}
      onOpen={vi.fn()}
      onRename={vi.fn()}
      onDelete={onDelete}
    />,
  );
  return { onDelete };
}

describe("CollectionChip", () => {
  /**
   * `Course Community - Collections.dc.html` draws this item as `#a4402a` over
   * a `#fdf3ef` hover, which is `--cc-danger-ink` over `--cc-danger-tint`. The
   * chip used to derive that hover with
   * `color-mix(in srgb, var(--cc-danger) 12%, var(--cc-surface))` because the
   * tint family did not exist yet (#127 §1) — and no mix of the solid colour
   * could have reached it in dark, where the design states the tint as alpha
   * over the page instead.
   *
   * Classes rather than computed colours: jsdom runs no Tailwind, so what is
   * assertable is the token the component asked for, which is what regressed.
   */
  it("paints Delete in the danger tint family, not a colour-mixed derivation", async () => {
    const user = userEvent.setup({ delay: null });
    renderChip();

    await user.click(
      screen.getByRole("button", { name: "More actions for Machine learning" }),
    );

    const remove = screen.getByRole("menuitem", { name: "Delete" });
    expect(remove).toHaveClass("text-cc-danger-ink", "hover:bg-cc-danger-tint");
    expect(remove.className).not.toContain("color-mix");
  });

  it("asks the page to delete rather than deleting anything itself", async () => {
    const user = userEvent.setup({ delay: null });
    const { onDelete } = renderChip();

    await user.click(
      screen.getByRole("button", { name: "More actions for Machine learning" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

    expect(onDelete).toHaveBeenCalledOnce();
    // The menu closes with it, so a second click cannot re-fire the mutation.
    expect(screen.queryByRole("menuitem", { name: "Delete" })).toBeNull();
  });
});
