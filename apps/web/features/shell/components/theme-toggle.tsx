"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

/**
 * The topbar's one control: a straight light/dark flip.
 *
 * The design drives the theme with a `data-cc-theme` attribute; this repo drives
 * it with a `.dark` class through Tailwind's `@custom-variant`, so `next-themes`
 * is configured with `attribute="class"` in `app/layout.tsx` and that mechanism
 * wins. Only the icon and the wording come from the artboard.
 *
 * **The icon is chosen by CSS, not by React.** Nothing about the resolved theme
 * is knowable on the server, so a component that renders one glyph has to pick
 * the light one and correct itself after mount — a moon visibly flipping to a
 * sun on every dark-theme page load, which is the flash #127 asks about.
 * Rendering *both* glyphs and letting the `dark:` variant hide one moves the
 * decision into the stylesheet, and `next-themes` writes `.dark` onto `<html>`
 * from a blocking script before first paint, so the right glyph is the only one
 * ever painted. Both are in the tree in both themes, so there is nothing for
 * hydration to disagree about.
 *
 * The accessible name cannot be done that way — a name is text, and a
 * `display:none` label is not reliably ignored by every screen reader — so it
 * keeps the `mounted` gate and reads "Switch theme" for one frame.
 *
 * That gate has to be `mounted` rather than `resolvedTheme === undefined`, and
 * the difference is not cosmetic: `next-themes` seeds `resolvedTheme` from
 * `defaultTheme` while it renders on the server but leaves it `undefined` on
 * the first client render, so a component branching on it renders one name on
 * each side and React reports the mismatch. `mounted` is false in both places
 * by construction. The name is only ever generic for that first frame, and
 * generic is true in both themes rather than wrong in one.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";
  const label = !mounted
    ? "Switch theme"
    : isDark
      ? "Switch to light mode"
      : "Switch to dark mode";

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex size-[34px] shrink-0 cursor-pointer items-center justify-center rounded-[8px] text-cc-chip-ink hover:bg-cc-pill"
    >
      <Moon size={15} strokeWidth={1.8} aria-hidden className="dark:hidden" />
      <Sun
        size={16}
        strokeWidth={1.8}
        aria-hidden
        className="hidden dark:block"
      />
    </button>
  );
}
