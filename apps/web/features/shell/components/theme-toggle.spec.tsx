import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "./theme-toggle";

/**
 * The toggle on its own, which is where the first-paint behaviour can actually
 * be seen. `app-shell.spec.tsx` covers it in place, but only after mount —
 * `render` flushes effects, so a shell test can never observe the frame the
 * reader complains about.
 */

const setTheme = vi.fn();
const useThemeResult = vi.fn();

vi.mock("next-themes", () => ({ useTheme: () => useThemeResult() }));

beforeEach(() => {
  setTheme.mockClear();
  useThemeResult.mockReturnValue({ resolvedTheme: "light", setTheme });
});

describe("the theme toggle", () => {
  it("offers dark from light", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(
      screen.getByRole("button", { name: "Switch to dark mode" }),
    );
    expect(setTheme).toHaveBeenCalledWith("dark");
  });

  it("offers light from dark", async () => {
    useThemeResult.mockReturnValue({ resolvedTheme: "dark", setTheme });
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(
      screen.getByRole("button", { name: "Switch to light mode" }),
    );
    expect(setTheme).toHaveBeenCalledWith("light");
  });

  /**
   * The regression behind #127's "the themes are not mapped consistently": the
   * toggle used to render one glyph chosen from `resolvedTheme`, which is
   * unknowable on the server, so every dark-theme page load painted a moon and
   * then flipped it to a sun. Both glyphs are in the tree now and the `dark:`
   * variant hides one, so the decision happens in CSS — before paint, and with
   * nothing for hydration to disagree about.
   *
   * Asserting the variant classes rather than what is visible is deliberate:
   * jsdom has no Tailwind, so visibility here would only ever be the absence of
   * a stylesheet. The classes are the contract.
   */
  it("renders both glyphs so the first paint needs no correction", () => {
    useThemeResult.mockReturnValue({ resolvedTheme: undefined, setTheme });
    render(<ThemeToggle />);

    const glyphs = [...screen.getByRole("button").querySelectorAll("svg")].map(
      (glyph) => glyph.getAttribute("class"),
    );

    expect(glyphs).toHaveLength(2);
    expect(glyphs.some((cls) => cls?.includes("dark:hidden"))).toBe(true);
    expect(glyphs.some((cls) => cls?.includes("hidden dark:block"))).toBe(true);
  });

  /**
   * The server render, which is the only place the pre-mount state can be seen
   * — `render` flushes effects, so `mounted` is already true by the time any
   * assertion above runs.
   *
   * It is asserted because getting it wrong is a hydration mismatch rather than
   * a cosmetic slip. An earlier attempt at this replaced the `mounted` gate
   * with `resolvedTheme === undefined`, on the assumption that `next-themes`
   * reports nothing until it has read storage. It reports `defaultTheme` while
   * rendering on the server and `undefined` on the first client render, so the
   * two sides named the button differently and React said so. The generic name
   * here is what proves the gate is not reading the theme.
   */
  it("names itself without claiming a theme, in the render the server sends", () => {
    // Whatever `next-themes` says on the server must not reach the markup.
    useThemeResult.mockReturnValue({ resolvedTheme: "light", setTheme });

    const markup = renderToStaticMarkup(<ThemeToggle />);

    expect(markup).toContain('aria-label="Switch theme"');
    expect(markup).not.toContain("Switch to dark mode");
    // Both glyphs ship in that first payload, so neither has to be swapped in.
    expect(markup.match(/<svg/g)).toHaveLength(2);
  });
});
