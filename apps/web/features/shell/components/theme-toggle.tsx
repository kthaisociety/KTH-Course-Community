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
 * Nothing about the resolved theme is known on the server, so the first paint
 * always shows the "switch to dark" face and corrects itself once mounted —
 * rendering the real face before then is a hydration mismatch.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex size-[34px] shrink-0 cursor-pointer items-center justify-center rounded-[8px] text-cc-chip-ink hover:bg-cc-pill"
    >
      {isDark ? (
        <Sun size={16} strokeWidth={1.8} aria-hidden />
      ) : (
        <Moon size={15} strokeWidth={1.8} aria-hidden />
      )}
    </button>
  );
}
